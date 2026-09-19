import { test, describe, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.UPTIMEMONK_DB = join(mkdtempSync(join(tmpdir(), "uptimemonk-delorg-")), "t.db");

const { openDb, closeDb, getDb } = await import("./index.js");
const repo = await import("./repo.js");

const DOOMED = "org-doomed";
const NEIGHBOUR = "org-neighbour";

before(() => openDb());
after(() => {
  closeDb();
  rmSync(process.env.UPTIMEMONK_DB!, { recursive: true, force: true });
});

/** A workspace with something in every table `deleteOrg` claims to clear. */
function seed(orgId: string, suffix: string) {
  const db = getDb();
  repo.upsertOrg(orgId, `Workspace ${suffix}`, "free");
  db.prepare(
    `INSERT INTO monitors (id, org_id, name, type, created_at, updated_at)
     VALUES (?, ?, ?, 'http', 1, 1)`
  ).run(`mon-${suffix}`, orgId, `Monitor ${suffix}`);
  db.prepare(
    `INSERT INTO hour_buckets (monitor_id, hour, org_id, up) VALUES (?, '2026091812', ?, 5)`
  ).run(`mon-${suffix}`, orgId);
  db.prepare(
    `INSERT INTO day_rollups (monitor_id, day, org_id, up) VALUES (?, '20260918', ?, 5)`
  ).run(`mon-${suffix}`, orgId);
  db.prepare(
    `INSERT INTO incidents (id, org_id, monitor_id, monitor_name, started_at)
     VALUES (?, ?, ?, ?, 1)`
  ).run(`inc-${suffix}`, orgId, `mon-${suffix}`, `Monitor ${suffix}`);
  db.prepare(
    `INSERT INTO alert_outbox (incident_id, contact_id, event, next_attempt_at, created_at)
     VALUES (?, ?, 'down', 1, 1)`
  ).run(`inc-${suffix}`, `con-${suffix}`);
  db.prepare(
    `INSERT INTO alert_contacts (id, org_id, channel, name, destination, enabled, verified)
     VALUES (?, ?, 'webhook', ?, 'https://example.com/hook', 1, 1)`
  ).run(`con-${suffix}`, orgId, `Contact ${suffix}`);
  repo.postCredit({ orgId, delta: 1_000, reason: "grant", ref: `evt-${suffix}` });
}

const count = (sql: string, ...args: unknown[]) =>
  (getDb().prepare(sql).get(...args) as { n: number }).n;

beforeEach(() => {
  const db = getDb();
  for (const t of [
    "alert_outbox",
    "incidents",
    "hour_buckets",
    "day_rollups",
    "monitors",
    "alert_contacts",
    "credit_ledger",
    "orgs",
  ]) {
    db.prepare(`DELETE FROM ${t}`).run();
  }
  seed(DOOMED, "a");
  seed(NEIGHBOUR, "b");
});

describe("deleting a workspace", () => {
  test("clears every table that holds rows for it", () => {
    repo.deleteOrg(DOOMED);

    assert.equal(count("SELECT COUNT(*) n FROM monitors WHERE org_id = ?", DOOMED), 0);
    assert.equal(count("SELECT COUNT(*) n FROM hour_buckets WHERE org_id = ?", DOOMED), 0);
    assert.equal(count("SELECT COUNT(*) n FROM day_rollups WHERE org_id = ?", DOOMED), 0);
    assert.equal(count("SELECT COUNT(*) n FROM incidents WHERE org_id = ?", DOOMED), 0);
    assert.equal(count("SELECT COUNT(*) n FROM alert_contacts WHERE org_id = ?", DOOMED), 0);
    assert.equal(count("SELECT COUNT(*) n FROM credit_ledger WHERE org_id = ?", DOOMED), 0);
    assert.equal(count("SELECT COUNT(*) n FROM orgs WHERE id = ?", DOOMED), 0);
  });

  test("takes the outbox rows with the incidents they reference", () => {
    // These carry no org_id of their own, so only the incident join reaches
    // them. Missing this leaves the drainer retrying alerts for a workspace
    // that no longer exists.
    repo.deleteOrg(DOOMED);
    assert.equal(count("SELECT COUNT(*) n FROM alert_outbox WHERE incident_id = 'inc-a'"), 0);
  });

  test("leaves every other workspace untouched", () => {
    // The whole point of scoping by org_id — a delete that took the fleet
    // with it would be catastrophic and silent.
    repo.deleteOrg(DOOMED);

    assert.equal(count("SELECT COUNT(*) n FROM monitors WHERE org_id = ?", NEIGHBOUR), 1);
    assert.equal(count("SELECT COUNT(*) n FROM hour_buckets WHERE org_id = ?", NEIGHBOUR), 1);
    assert.equal(count("SELECT COUNT(*) n FROM day_rollups WHERE org_id = ?", NEIGHBOUR), 1);
    assert.equal(count("SELECT COUNT(*) n FROM incidents WHERE org_id = ?", NEIGHBOUR), 1);
    assert.equal(count("SELECT COUNT(*) n FROM alert_contacts WHERE org_id = ?", NEIGHBOUR), 1);
    assert.equal(count("SELECT COUNT(*) n FROM credit_ledger WHERE org_id = ?", NEIGHBOUR), 1);
    assert.equal(count("SELECT COUNT(*) n FROM orgs WHERE id = ?", NEIGHBOUR), 1);
    assert.equal(count("SELECT COUNT(*) n FROM alert_outbox WHERE incident_id = 'inc-b'"), 1);
  });

  test("reports what it removed, so the log is not a guess", () => {
    const removed = repo.deleteOrg(DOOMED);
    assert.deepEqual(removed, { monitors: 1, contacts: 1, ledger: 1 });
  });

  test("deleting a workspace that does not exist is harmless", () => {
    const removed = repo.deleteOrg("org-never-existed");
    assert.deepEqual(removed, { monitors: 0, contacts: 0, ledger: 0 });
    assert.equal(count("SELECT COUNT(*) n FROM orgs"), 2);
  });
});
