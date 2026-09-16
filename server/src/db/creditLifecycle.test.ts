import { test, describe, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.UPTIMEMONK_DB = join(mkdtempSync(join(tmpdir(), "uptimemonk-life-")), "t.db");

const { openDb, closeDb, getDb } = await import("./index.js");
const repo = await import("./repo.js");
const {
  FREE_CHECKS_PER_DAY,
  burnDay,
  budgetFor,
  applyGrant,
  monthlyGrantCents,
  checksPerDay,
  fitsBudget,
} = await import("../lib/credits.js");

const ORG = "org1";

before(() => openDb());
after(() => {
  closeDb();
  rmSync(process.env.UPTIMEMONK_DB!, { recursive: true, force: true });
});
beforeEach(() => {
  for (const t of ["credit_ledger", "day_rollups", "orgs"]) {
    getDb().prepare(`DELETE FROM ${t}`).run();
  }
  repo.upsertOrg(ORG, "Test", "free");
});

const balance = () =>
  (getDb().prepare("SELECT credits FROM orgs WHERE id = ?").get(ORG) as any).credits;

/** The invariant the whole design rests on: the balance is exactly what the
 *  movements add up to. If these ever diverge, the ledger is decorative. */
function assertReconciles() {
  const summed = repo
    .creditLedger(ORG, 10_000)
    .reduce((sum, e) => sum + e.delta, 0);
  assert.equal(
    balance(),
    Math.max(0, summed),
    `ledger sums to ${summed} but balance column is ${balance()}`
  );
}

/** One day of usage, charged the way the nightly rollup charges it. */
function runDay(day: string, checksUsed: number) {
  const before = repo.getOrgCredit(ORG);
  const after = burnDay(before, checksUsed);
  const delta = after.credits - before.credits;
  if (delta !== 0) repo.postCredit({ orgId: ORG, delta, reason: "burn", ref: day });
  if (after.graceUntil !== before.graceUntil) {
    repo.setDonationState(ORG, { graceUntil: after.graceUntil });
  }
}

describe("adding credit", () => {
  test("a $2.99 donation lands exactly once and reconciles", () => {
    repo.postCredit({
      orgId: ORG,
      delta: monthlyGrantCents(299),
      reason: "grant",
      ref: "evt_1",
    });
    assert.equal(balance(), 897_000);
    assertReconciles();
  });

  test("two donations accumulate", () => {
    repo.postCredit({ orgId: ORG, delta: monthlyGrantCents(299), reason: "grant", ref: "e1" });
    repo.postCredit({ orgId: ORG, delta: monthlyGrantCents(299), reason: "grant", ref: "e2" });
    assert.equal(balance(), 1_794_000);
    assertReconciles();
  });

  test("a refund removes exactly what it added", () => {
    repo.postCredit({ orgId: ORG, delta: monthlyGrantCents(299), reason: "grant", ref: "e1" });
    repo.postCredit({ orgId: ORG, delta: -monthlyGrantCents(299), reason: "refund", ref: "e2" });
    assert.equal(balance(), 0);
    assertReconciles();
  });
});

describe("deducting credit", () => {
  test("credit pays for every check a donor runs", () => {
    repo.postCredit({ orgId: ORG, delta: 1_000_000, reason: "grant", ref: "e1" });
    runDay("20260901", 50_000);
    assert.equal(balance(), 950_000);
    assertReconciles();
  });

  test("charging the same day twice is impossible", () => {
    repo.postCredit({ orgId: ORG, delta: 1_000_000, reason: "grant", ref: "e1" });
    runDay("20260901", 50_000);
    runDay("20260901", 50_000);
    assert.equal(balance(), 950_000);
    assertReconciles();
  });

  test("a free workspace burns nothing and never goes negative", () => {
    runDay("20260901", FREE_CHECKS_PER_DAY * 50);
    assert.equal(balance(), 0);
    assertReconciles();
  });
});

describe("a donor's month, day by day", () => {
  test("credit drains at the advertised rate and lands in grace, not darkness", () => {
    // $2.99 buys 897,000 checks. Twenty monitors at 45s costs 38,400/day,
    // and credit pays for all of it.
    repo.postCredit({
      orgId: ORG,
      delta: monthlyGrantCents(299),
      reason: "grant",
      ref: "evt_1",
    });

    const dailyUse = 20 * checksPerDay(45);
    let daysServed = 0;

    for (let d = 1; d <= 45; d++) {
      const day = `202609${String(d).padStart(2, "0")}`;
      const before = balance();
      runDay(day, dailyUse);
      if (before > 0) daysServed++;
    }

    assertReconciles();
    assert.equal(balance(), 0, "the month's credit should be spent");
    // The whole point of the rate: a real workload exhausts a grant inside a
    // month, so the donation is worth repeating.
    assert.ok(daysServed <= 31, `served ${daysServed} days, longer than sold`);
    assert.ok(daysServed >= 20, `only served ${daysServed} days`);

    // Out of credit is not out of service.
    const credit = repo.getOrgCredit(ORG);
    assert.equal(budgetFor(credit), FREE_CHECKS_PER_DAY, "falls back to free, not zero");
  });

  test("the daily budget matches what was advertised, not the whole balance", () => {
    // The unit bug: `credits` is a month's total, `budgetFor` returns a daily
    // rate. Returning the balance let one donor configure thirty times the
    // rate they bought, and four times the box's entire safe capacity.
    const donor = applyGrant(
      { credits: 0, donationUsdMonthly: 0, graceUntil: null },
      299
    );
    const daily = budgetFor(donor);

    assert.ok(daily < 60_000, `daily budget ${daily} is far above the 29,900 sold`);
    assert.ok(daily > 25_000, `daily budget ${daily} is below what was sold`);
    assert.equal(daily, FREE_CHECKS_PER_DAY + 29_900);
  });

  test("that budget is what the create path actually enforces", () => {
    const donor = applyGrant(
      { credits: 0, donationUsdMonthly: 0, graceUntil: null },
      299
    );
    const at1min = (n: number) => Array(n).fill({ intervalSeconds: 60, enabled: true });

    assert.equal(fitsBudget(donor, at1min(30)).ok, true, "30 monitors fit what was sold");
    assert.equal(fitsBudget(donor, at1min(200)).ok, false, "200 does not");
  });
});
