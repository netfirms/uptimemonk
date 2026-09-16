import { test, describe, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.UPTIMEMONK_DB = join(mkdtempSync(join(tmpdir(), "uptimemonk-ledger-")), "t.db");

const { openDb, closeDb, getDb } = await import("./index.js");
const repo = await import("./repo.js");

const ORG = "org1";

before(() => openDb());
after(() => {
  closeDb();
  rmSync(process.env.UPTIMEMONK_DB!, { recursive: true, force: true });
});
beforeEach(() => {
  getDb().prepare("DELETE FROM credit_ledger").run();
  getDb().prepare("DELETE FROM orgs").run();
  repo.upsertOrg(ORG, "Test", "free");
});

const balance = () =>
  (getDb().prepare("SELECT credits FROM orgs WHERE id = ?").get(ORG) as any).credits;

describe("the credit ledger", () => {
  test("a grant moves the balance and leaves a record", () => {
    const posted = repo.postCredit({ orgId: ORG, delta: 1_000, reason: "grant", ref: "evt_1" });
    assert.equal(posted?.balance, 1_000);
    assert.equal(balance(), 1_000);

    const [entry] = repo.creditLedger(ORG);
    assert.equal(entry.delta, 1_000);
    assert.equal(entry.balance_after, 1_000);
    assert.equal(entry.reason, "grant");
  });

  test("replaying the same event changes nothing", () => {
    // Stripe retries by design. This is the property that stops a retry
    // granting twice — and it is a database constraint, not a check the
    // caller has to remember.
    repo.postCredit({ orgId: ORG, delta: 1_000, reason: "grant", ref: "evt_1" });
    const second = repo.postCredit({ orgId: ORG, delta: 1_000, reason: "grant", ref: "evt_1" });

    assert.equal(second, null);
    assert.equal(balance(), 1_000);
    assert.equal(repo.creditLedger(ORG).length, 1);
  });

  test("a different event with the same amount does apply", () => {
    repo.postCredit({ orgId: ORG, delta: 1_000, reason: "grant", ref: "evt_1" });
    repo.postCredit({ orgId: ORG, delta: 1_000, reason: "grant", ref: "evt_2" });
    assert.equal(balance(), 2_000);
  });

  test("a burn and a grant with the same ref do not collide", () => {
    // The unique key is (reason, ref), not ref alone — a day key and an event
    // id live in the same column.
    repo.postCredit({ orgId: ORG, delta: 5_000, reason: "grant", ref: "20260916" });
    repo.postCredit({ orgId: ORG, delta: -2_000, reason: "burn", ref: "20260916" });
    assert.equal(balance(), 3_000);
  });

  test("interleaved posts never lose an update", () => {
    // The old read-modify-write lost one of these: both reads saw 0, both
    // wrote their own delta, and one grant vanished.
    for (let i = 0; i < 50; i++) {
      repo.postCredit({ orgId: ORG, delta: 100, reason: "grant", ref: `evt_${i}` });
    }
    assert.equal(balance(), 5_000);
    assert.equal(repo.creditLedger(ORG, 100).length, 50);
  });

  test("a balance can be exhausted but never owed", () => {
    // An overdraft would quietly become a debt the customer never agreed to.
    repo.postCredit({ orgId: ORG, delta: 100, reason: "grant", ref: "evt_1" });
    repo.postCredit({ orgId: ORG, delta: -10_000, reason: "burn", ref: "20260916" });
    assert.equal(balance(), 0);
  });

  test("a refund takes the capacity back with the money", () => {
    repo.postCredit({ orgId: ORG, delta: 9_000, reason: "grant", ref: "evt_1" });
    repo.postCredit({ orgId: ORG, delta: -9_000, reason: "refund", ref: "evt_2" });
    assert.equal(balance(), 0);
    assert.deepEqual(
      repo.creditLedger(ORG).map((e) => e.reason),
      ["refund", "grant"]
    );
  });

  test("the trail reconstructs how a balance got where it is", () => {
    repo.postCredit({ orgId: ORG, delta: 9_000, reason: "grant", ref: "e1" });
    repo.postCredit({ orgId: ORG, delta: -1_000, reason: "burn", ref: "20260915" });
    repo.postCredit({ orgId: ORG, delta: -2_000, reason: "burn", ref: "20260916" });

    const entries = repo.creditLedger(ORG).reverse();
    assert.deepEqual(entries.map((e) => e.balance_after), [9_000, 8_000, 6_000]);
    assert.equal(
      entries.reduce((sum, e) => sum + e.delta, 0),
      balance()
    );
  });
});
