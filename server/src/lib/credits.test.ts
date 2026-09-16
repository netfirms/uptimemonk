import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  CHECKS_PER_DAY_PER_USD,
  FREE_CHECKS_PER_DAY,
  GRACE_DAYS,
  applyGrant,
  budgetFor,
  burnDay,
  checksPerDay,
  fitsBudget,
  monthlyGrant,
  monthlyGrantCents,
  rolloverCap,
  standingOf,
  totalChecksPerDay,
  type OrgCredit,
} from "./credits.js";

const free = (): OrgCredit => ({ credits: 0, donationUsdMonthly: 0, graceUntil: null });
const donor = (usd = 5, credits = monthlyGrant(usd)): OrgCredit => ({
  credits,
  donationUsdMonthly: usd,
  graceUntil: null,
});
const mon = (intervalSeconds: number, enabled = true) => ({ intervalSeconds, enabled });
/** `applyGrant` takes cents, because money does not round to whole dollars.
 *  Spelling the conversion out here keeps the unit unambiguous at call sites. */
const USD = (dollars: number) => Math.round(dollars * 100);

describe("what a check costs", () => {
  test("cost is per check, not per monitor", () => {
    // The whole point: a 5-second monitor is 12x a 1-minute one, and the old
    // per-monitor model charged them the same.
    assert.equal(checksPerDay(60), 1_440);
    assert.equal(checksPerDay(5), 17_280);
    assert.equal(checksPerDay(5) / checksPerDay(60), 12);
  });

  test("the free allowance is exactly the old free plan", () => {
    // 10 monitors at 60s. Nothing regresses for anyone already here.
    assert.equal(totalChecksPerDay(Array(10).fill(mon(60))), FREE_CHECKS_PER_DAY);
  });

  test("a paused monitor costs nothing", () => {
    assert.equal(totalChecksPerDay([mon(5, false)]), 0);
  });

  test("an absurdly fast interval is priced at the scheduler floor, not as asked", () => {
    assert.equal(checksPerDay(1), checksPerDay(5));
  });
});

describe("standing", () => {
  test("never having donated is 'free', not a failure state", () => {
    assert.equal(standingOf(free()), "free");
  });

  test("in credit is 'donor'", () => {
    assert.equal(standingOf(donor()), "donor");
  });

  test("out of credit but inside the window is 'grace'", () => {
    const c = { credits: 0, donationUsdMonthly: 5, graceUntil: Date.now() + 86_400_000 };
    assert.equal(standingOf(c), "grace");
  });

  test("past the window is 'lapsed'", () => {
    const c = { credits: 0, donationUsdMonthly: 5, graceUntil: Date.now() - 1 };
    assert.equal(standingOf(c), "lapsed");
  });
});

describe("the budget", () => {
  test("a free workspace gets the free rate and nothing else", () => {
    assert.equal(budgetFor(free()), FREE_CHECKS_PER_DAY);
  });

  test("a donor gets the free rate on top of what they gave", () => {
    assert.ok(budgetFor(donor()) > FREE_CHECKS_PER_DAY);
  });

  test("grace keeps full service — that is what makes it grace", () => {
    const lapsing = { credits: 0, donationUsdMonthly: 10, graceUntil: Date.now() + 1000 };
    assert.ok(budgetFor(lapsing) > FREE_CHECKS_PER_DAY);
  });

  test("lapsed falls back to free, not to zero", () => {
    // Cutting monitoring off entirely because a card expired would be the
    // worst version of the failure this product exists to prevent.
    const lapsed = { credits: 0, donationUsdMonthly: 5, graceUntil: Date.now() - 1 };
    assert.equal(budgetFor(lapsed), FREE_CHECKS_PER_DAY);
  });
});

describe("fitting the budget", () => {
  test("ten 1-minute monitors fit a free workspace exactly", () => {
    assert.equal(fitsBudget(free(), Array(10).fill(mon(60))).ok, true);
  });

  test("an eleventh does not", () => {
    const v = fitsBudget(free(), Array(11).fill(mon(60)));
    assert.equal(v.ok, false);
    assert.match(v.reason!, /checks a day/);
  });

  test("a free workspace may spend its whole allowance on one fast monitor", () => {
    // 14,400/day buys one monitor at 6s. Under the old model this was
    // impossible at any price on free, despite costing the same.
    assert.equal(fitsBudget(free(), [mon(6)]).ok, true);
  });

  test("the refusal talks about checks, not about a tier the user cannot see", () => {
    const v = fitsBudget(free(), Array(50).fill(mon(60)));
    assert.ok(!/plan/i.test(v.reason!), v.reason);
    assert.match(v.reason!, /support the project/);
  });

  test("a donation buys real headroom over the free allowance", () => {
    // $5 of credit allows ~50,000 checks/day on top of free: about 44
    // monitors at one minute, against the free tier's ten.
    assert.equal(fitsBudget(donor(5), Array(40).fill(mon(60))).ok, true);
    assert.equal(fitsBudget(donor(5), Array(200).fill(mon(60))).ok, false);
  });
});

describe("granting and burning", () => {
  test("a dollar buys what the constant says", () => {
    assert.equal(monthlyGrant(1), CHECKS_PER_DAY_PER_USD * 30);
  });

  test("grants are cent-accurate, not rounded to dollars", () => {
    // The bug a $0.99 price point exposed: rounding to whole dollars granted
    // nothing at all for $0.49 — real money, no capacity — and gave a $1.50
    // donation a third more than it paid for.
    assert.equal(monthlyGrantCents(99), Math.round(0.99 * CHECKS_PER_DAY_PER_USD * 30));
    assert.ok(monthlyGrantCents(49) > 0, "$0.49 must buy something");
    assert.equal(monthlyGrantCents(150), Math.round(1.5 * CHECKS_PER_DAY_PER_USD * 30));
    assert.equal(monthlyGrantCents(0), 0);
  });

  test("a $2.99 donation runs out inside a month for a real workload", () => {
    // The point of the rate. Credit pays for every check, so a workspace
    // actually using the product exhausts a grant in about a month and comes
    // back — rather than one $2.99 funding years of service.
    const grant = monthlyGrantCents(299);
    assert.equal(grant, 897_000);

    // The target: more than ten monitors, meaningfully faster than a minute.
    for (const [count, interval] of [
      [11, 30],
      [15, 30],
      [20, 45],
      [30, 30],
      [50, 60],
    ] as const) {
      const days = grant / (count * checksPerDay(interval));
      assert.ok(
        days <= 31,
        `${count} monitors at ${interval}s lasted ${days.toFixed(1)} days`
      );
    }
  });

  test("even the lightest paying workload is bounded in months, not years", () => {
    // Eleven monitors at 59s is only 12% above the free tier's own load, so
    // it cannot deplete as fast as a real workload — and it should not, since
    // that workspace is barely costing anything. What matters is that it is
    // finite: before the rate was fixed this same case ran for fourteen years
    // on one $2.99 donation.
    const grant = monthlyGrantCents(299);
    const days = grant / (11 * checksPerDay(59));
    assert.ok(days < 60, `lightest workload lasted ${days.toFixed(0)} days`);
  });

  test("a grant clears any grace window — coming back is just coming back", () => {
    const lapsing = { credits: 0, donationUsdMonthly: 5, graceUntil: Date.now() + 1000 };
    assert.equal(applyGrant(lapsing, USD(5)).graceUntil, null);
  });

  test("roll-over is capped, so a lapsed donor cannot coast for a year", () => {
    let c = donor(5, 0);
    for (let i = 0; i < 12; i++) c = applyGrant(c, USD(5));
    assert.equal(c.credits, rolloverCap(5));
  });

  test("credit pays for every check, not only those above the free rate", () => {
    // Discounting the free allowance off a donor's burn made a light donor's
    // grant last years: eleven monitors at 59s burned 1,715 a day against a
    // balance sized for hundreds of thousands.
    const before = donor();
    const after = burnDay(before, 10_000);
    assert.equal(before.credits - after.credits, 10_000);
  });

  test("a workspace with no credit is not charged at all", () => {
    assert.equal(burnDay(free(), 500_000).credits, 0);
  });

  test("a free workspace can never go negative", () => {
    assert.equal(burnDay(free(), FREE_CHECKS_PER_DAY * 100).credits, 0);
  });

  test("hitting zero opens the grace window rather than cutting service", () => {
    const now = Date.now();
    const after = burnDay(donor(5, 100), FREE_CHECKS_PER_DAY + 1_000_000, now);
    assert.equal(after.credits, 0);
    assert.equal(after.graceUntil, now + GRACE_DAYS * 86_400_000);
    assert.equal(standingOf(after, now), "grace");
  });

  test("the window is opened once, not extended on every later burn", () => {
    const now = Date.now();
    const emptied = burnDay(donor(5, 100), FREE_CHECKS_PER_DAY + 1_000, now);
    const again = burnDay(emptied, FREE_CHECKS_PER_DAY + 1_000, now + 86_400_000);
    assert.equal(again.graceUntil, emptied.graceUntil);
  });
});

describe("grandfathered plans", () => {
  test("a legacy paid plan raises the free allowance, it does not gate anything", () => {
    const legacy: OrgCredit = {
      credits: 0,
      donationUsdMonthly: 0,
      graceUntil: null,
      baseChecksPerDay: FREE_CHECKS_PER_DAY + 50 * 1_440,
    };
    // Someone who bought "50 monitors at 1 minute" still has exactly that,
    // without donating anything.
    assert.equal(fitsBudget(legacy, Array(60).fill(mon(60))).ok, true);
    assert.equal(fitsBudget(legacy, Array(61).fill(mon(60))).ok, false);
  });

  test("their raised allowance widens the budget, not the burn", () => {
    const legacy: OrgCredit = {
      credits: 1_000,
      donationUsdMonthly: 0,
      graceUntil: null,
      baseChecksPerDay: FREE_CHECKS_PER_DAY * 2,
    };
    // The bonus is free capacity to configure against...
    assert.ok(budgetFor(legacy) >= FREE_CHECKS_PER_DAY * 2);
    // ...but any credit they also hold is still spent per check.
    assert.equal(burnDay(legacy, 400).credits, 600);
  });
});
