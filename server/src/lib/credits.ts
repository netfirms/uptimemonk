import type { Monitor } from "../types.js";

/**
 * Donation credits.
 *
 * This replaces the plan paywall. Nothing is locked behind a purchase: what a
 * donation buys is *capacity*, and capacity is the one thing that genuinely
 * costs money here. A check is the unit because a check is the cost — a probe,
 * a row in the hour bucket, a sample in its JSON array. Counting monitors
 * instead would charge the same for a 5-second check and a daily one, which
 * differ by a factor of 17,280.
 *
 * The shape:
 *
 *   - Every org gets FREE_CHECKS_PER_DAY for nothing, forever. A free account
 *     never touches credits and never expires.
 *   - Usage *above* that free rate burns donated credits.
 *   - A recurring donation tops the balance up each cycle; unused credits roll
 *     over up to a cap, so a quiet month is not punished.
 *   - When the balance runs out, a grace window starts. After it, the org is
 *     held to the free rate — existing monitors keep running, they are just
 *     slowed and no new ones can be added beyond the free budget.
 *
 * Nothing is ever deleted for running out of credit. Monitoring that silently
 * stops is the failure this whole product exists to prevent, and doing it to
 * someone because their card expired would be the worst version of it.
 */

/** Free forever: exactly today's free plan — 10 monitors at 60s. Nothing
 *  regresses for anyone already using the product. */
export const FREE_CHECKS_PER_DAY = 14_400;

/**
 * What a dollar buys, per day.
 *
 * Derived from measurement, not from what competitors charge. A check costs
 * 41.5 bytes of sample JSON (measured on the live box); with SQLite row and
 * index overhead that is ~70 bytes on disk, and at 35 days of bucket retention
 * a 10 GB database budget sustains roughly 4M checks/day. Half of that is the
 * safe committed figure, so one $5 worker carries about 2M checks/day.
 *
 * At this rate a $0.99 donation buys ~99,000 checks/day, so ~20 donors fill a
 * worker and cover its cost about four times over. If the storage figure or
 * the box changes, this is the number to re-derive.
 */
export const CHECKS_PER_DAY_PER_USD = 100_000;

/** Days of full service after the balance empties, before free limits apply. */
export const GRACE_DAYS = 7;

/** Roll-over ceiling, as multiples of a cycle's grant. Unlimited hoarding
 *  would let a lapsed donor coast for a year on a single generous month. */
export const ROLLOVER_CYCLES = 2;

/** The floor no amount of donation goes below — a scheduler limit, not a
 *  commercial one. See MIN_INTERVAL_SECONDS in scheduler.ts. */
export const HARD_MIN_INTERVAL_SECONDS = 5;

/** A ceiling on monitor count regardless of credit, so one org cannot fill the
 *  heap. Generous enough that nobody legitimate meets it. */
export const HARD_MAX_MONITORS = 2_000;

export interface OrgCredit {
  /** Donated checks remaining. Free usage never draws on this. */
  credits: number;
  /** The recurring donation, in whole USD per month. 0 = not donating. */
  donationUsdMonthly: number;
  /** Set when the balance first empties; null while in credit. */
  graceUntil: number | null;
  /**
   * This org's free daily allowance. Defaults to `FREE_CHECKS_PER_DAY`; a
   * legacy paid plan raises it, so nobody who bought a plan under the old
   * paywall ends up with less capacity than they were sold.
   */
  baseChecksPerDay?: number;
}

const baseOf = (c: OrgCredit) => c.baseChecksPerDay ?? FREE_CHECKS_PER_DAY;

/** Checks per day a monitor at this interval performs. */
export function checksPerDay(intervalSeconds: number): number {
  return Math.ceil(86_400 / Math.max(HARD_MIN_INTERVAL_SECONDS, intervalSeconds));
}

/** What an org's whole monitor set costs per day. */
export function totalChecksPerDay(monitors: Pick<Monitor, "intervalSeconds" | "enabled">[]): number {
  return monitors
    .filter((m) => m.enabled)
    .reduce((sum, m) => sum + checksPerDay(m.intervalSeconds), 0);
}

/**
 * A cycle's grant, from the amount actually paid **in cents**.
 *
 * Cents, not rounded dollars. The first version did `Math.round(usd)`, which
 * granted nothing at all for $0.49 — real money, no capacity — and over-granted
 * a $1.50 donation by a third. Money does not round to the nearest dollar.
 */
export const monthlyGrantCents = (cents: number) =>
  Math.max(0, Math.round((cents / 100) * CHECKS_PER_DAY_PER_USD * 30));

/** Convenience for whole-dollar callers and copy. */
export const monthlyGrant = (usd: number) => monthlyGrantCents(Math.max(0, usd) * 100);

export const rolloverCapCents = (cents: number) => monthlyGrantCents(cents) * ROLLOVER_CYCLES;
export const rolloverCap = (usd: number) => monthlyGrant(usd) * ROLLOVER_CYCLES;

export type Standing = "free" | "donor" | "grace" | "lapsed";

/**
 * Where an org stands right now.
 *
 * `free` is not a failure state — most orgs live here permanently and are
 * entitled to everything the free rate buys.
 */
export function standingOf(c: OrgCredit, now = Date.now()): Standing {
  if (c.credits > 0) return "donor";
  if (c.graceUntil && now < c.graceUntil) return "grace";
  return c.donationUsdMonthly > 0 || c.graceUntil ? "lapsed" : "free";
}

/**
 * The daily check budget an org may spend.
 *
 * In credit or in grace, the budget is effectively uncapped at write time —
 * the balance is what limits them, and it is drawn down by actual usage rather
 * than predicted usage. Out of credit, they are held to the free rate.
 */
/** A grant is quoted and sold as a month's worth, so a balance spreads over
 *  that many days when it is turned into a daily rate. */
export const GRANT_DAYS = 30;

export function budgetFor(c: OrgCredit, now = Date.now()): number {
  const standing = standingOf(c, now);
  if (standing !== "donor" && standing !== "grace") return baseOf(c);

  /**
   * The balance spread over a month, **not** the balance itself.
   *
   * `credits` is a total — $2.99 buys 8,970,000 checks — while this function
   * returns a per-day figure. Returning the balance directly was a unit error
   * that let one donor configure 8.98M checks a day: thirty times the rate
   * they were sold, four times the whole box's safe capacity, and their entire
   * month's credit burnt in a single day.
   *
   * Spreading it also tapers naturally. As credit depletes the allowed rate
   * falls with it, so there is no cliff at zero — and monitors already running
   * are never touched, because the budget is only checked when something is
   * created or edited.
   */
  const fromBalance = c.credits / GRANT_DAYS;
  // A recurring donor is entitled to their cycle's rate even if the balance is
  // momentarily low, having committed to the next top-up.
  const fromPledge = monthlyGrant(c.donationUsdMonthly) / GRANT_DAYS;

  return Math.floor(baseOf(c) + Math.max(fromBalance, fromPledge));
}

export interface BudgetCheck {
  ok: boolean;
  used: number;
  budget: number;
  standing: Standing;
  reason?: string;
}

/**
 * Would this set of monitors fit the org's budget?
 *
 * Called on every create and edit with the *prospective* set, so the answer is
 * about the state being asked for rather than the current one.
 */
export function fitsBudget(
  c: OrgCredit,
  monitors: Pick<Monitor, "intervalSeconds" | "enabled">[],
  now = Date.now()
): BudgetCheck {
  const used = totalChecksPerDay(monitors);
  const budget = budgetFor(c, now);
  const standing = standingOf(c, now);

  if (used <= budget) return { ok: true, used, budget, standing };

  const perDay = (n: number) => n.toLocaleString();
  return {
    ok: false,
    used,
    budget,
    standing,
    reason:
      standing === "free" || standing === "lapsed"
        ? `That needs ${perDay(used)} checks a day and this workspace has ` +
          `${perDay(budget)}. Slow some monitors down, or support the project ` +
          `to raise the budget.`
        : `That needs ${perDay(used)} checks a day and your balance covers ` +
          `${perDay(budget)}.`,
  };
}

/**
 * Apply a cycle's donation.
 *
 * Roll-over is capped, and any grace window is cleared: a donor who comes back
 * is simply back, not still serving out a penalty.
 */
export function applyGrant(c: OrgCredit, cents: number): OrgCredit {
  const grant = monthlyGrantCents(cents);
  const cap = rolloverCapCents(cents);
  return {
    credits: Math.min(c.credits + grant, cap || grant),
    // Kept in whole dollars for display; the grant itself is cent-accurate.
    donationUsdMonthly: cents / 100,
    graceUntil: null,
  };
}

/**
 * Burn a day's usage.
 *
 * Only what exceeds the free rate is charged, so a free account never goes
 * negative and a donor is not billed for the part everyone gets anyway.
 * Hitting zero opens the grace window rather than cutting service instantly.
 */
export function burnDay(c: OrgCredit, checksUsed: number, now = Date.now()): OrgCredit {
  const chargeable = Math.max(0, checksUsed - baseOf(c));
  if (chargeable === 0) return c;

  const credits = Math.max(0, c.credits - chargeable);
  return {
    ...c,
    credits,
    graceUntil:
      credits === 0 && c.credits > 0
        ? now + GRACE_DAYS * 86_400_000
        : c.graceUntil,
  };
}
