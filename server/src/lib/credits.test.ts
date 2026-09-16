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

  test("$5 a month buys real headroom", () => {
    assert.equal(fitsBudget(donor(5), Array(100).fill(mon(60))).ok, true);
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

  test("a $0.99 donation buys about a month of real use", () => {
    // 99,000 checks/day. A donor running 69 monitors at one minute burns
    // ~85k/day above the free allowance, so the block lasts roughly a month.
    const grant = monthlyGrantCents(99);
    assert.equal(grant, 2_970_000);
    const dailyBurn = 69 * checksPerDay(60) - FREE_CHECKS_PER_DAY;
    assert.ok(grant / dailyBurn > 28, `lasted only ${(grant / dailyBurn).toFixed(0)} days`);
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

  test("usage inside the free rate never touches credits", () => {
    const before = donor();
    assert.equal(burnDay(before, FREE_CHECKS_PER_DAY).credits, before.credits);
  });

  test("only the excess over free is charged", () => {
    const before = donor();
    const after = burnDay(before, FREE_CHECKS_PER_DAY + 1_000);
    assert.equal(before.credits - after.credits, 1_000);
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

  test("their burn is charged above their own allowance, not the standard one", () => {
    const legacy: OrgCredit = {
      credits: 1_000,
      donationUsdMonthly: 0,
      graceUntil: null,
      baseChecksPerDay: FREE_CHECKS_PER_DAY * 2,
    };
    // Usage inside the raised allowance must not eat donated credit.
    assert.equal(burnDay(legacy, FREE_CHECKS_PER_DAY * 2).credits, 1_000);
  });
});
