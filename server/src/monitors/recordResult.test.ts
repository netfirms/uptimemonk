import { test, describe, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.UPTIMEMONK_DB = join(
  mkdtempSync(join(tmpdir(), "uptimemonk-test-")),
  "test.db"
);

const { openDb, closeDb, getDb } = await import("../db/index.js");
const repo = await import("../db/repo.js");
const { recordResult, flush } = await import("./recordResult.js");
const { hourKey } = await import("../lib/time.js");

/**
 * Integration test for the hot write path: state machine → SQLite → incident →
 * outbox. This is the code that decides whether someone gets woken at 3am, and
 * the parts that can only fail together are exactly the parts worth testing
 * together.
 */

const MONITOR_ID = "m1";
const ORG_ID = "org1";
const dbDir = () => process.env.UPTIMEMONK_DB!;

const countRows = (table: string): number =>
  (getDb().prepare(`SELECT COUNT(*) c FROM ${table}`).get() as { c: number }).c;

function seedMonitor(overrides: Record<string, unknown> = {}) {
  repo.upsertMonitorConfig({
    id: MONITOR_ID,
    orgId: ORG_ID,
    name: "Marketing site",
    type: "http",
    target: "https://example.com",
    intervalSeconds: 300,
    timeoutSeconds: 10,
    confirmationThreshold: 2,
    regions: ["ap-southeast-1"],
    enabled: true,
    maintenanceWindows: [],
    alertContactIds: ["c1"],
    status: "pending",
    consecutiveFailures: 0,
    inMaintenance: false,
    dueAt: Date.now(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  } as never);

  repo.upsertContact({
    id: "c1",
    orgId: ORG_ID,
    channel: "email",
    name: "Ops",
    destination: "ops@example.com",
    enabled: true,
    verified: true,
  });
}

const result = (ok: boolean, at = Date.now()) => ({
  ok,
  responseTimeMs: ok ? 120 : 0,
  statusCode: ok ? 200 : 503,
  error: ok ? undefined : "Unexpected status 503",
  region: "ap-southeast-1" as const,
  checkedAt: at,
});

before(() => openDb());
after(() => {
  closeDb();
  rmSync(dbDir(), { recursive: true, force: true });
});

beforeEach(() => {
  const db = getDb();
  for (const t of ["alert_outbox", "incidents", "hour_buckets", "monitors", "alert_contacts"]) {
    db.prepare(`DELETE FROM ${t}`).run();
  }
  seedMonitor();
});

describe("recordResult", () => {
  test("buffers until flushed, so probes never block on a write", () => {
    const m = repo.getMonitor(MONITOR_ID)!;
    recordResult(m, result(true));

    assert.equal(
      repo.getMonitor(MONITOR_ID)!.lastCheckedAt ?? null,
      null,
      "nothing written before flush"
    );

    flush();
    assert.ok(repo.getMonitor(MONITOR_ID)!.lastCheckedAt, "written after flush");
  });

  test("accumulates counters and samples into one row per hour", () => {
    const m = repo.getMonitor(MONITOR_ID)!;
    const at = Date.UTC(2026, 8, 16, 10, 0, 0);

    for (let i = 0; i < 5; i++) recordResult(m, result(true, at + i * 1000));
    recordResult(m, result(false, at + 6000));
    flush();

    const row: any = getDb()
      .prepare("SELECT * FROM hour_buckets WHERE monitor_id = ? AND hour = ?")
      .get(MONITOR_ID, hourKey(at));

    assert.equal(row.up, 5);
    assert.equal(row.down, 1);
    assert.equal(JSON.parse(row.samples).length, 6, "every sample kept");
    assert.equal(
      countRows("hour_buckets"),
      1,
      "one row for the hour, not one per check"
    );
  });

  test("opens an incident only at the confirmation threshold", () => {
    const m = repo.getMonitor(MONITOR_ID)!;

    recordResult(m, result(false));
    flush();
    assert.equal(
      countRows("incidents"),
      0,
      "one failure is not an outage"
    );

    recordResult(m, result(false));
    flush();
    assert.equal(countRows("incidents"), 1);
    assert.equal(repo.getMonitor(MONITOR_ID)!.status, "down");
  });

  test("queues alerts in the same transaction as the incident", () => {
    const m = repo.getMonitor(MONITOR_ID)!;
    recordResult(m, result(false));
    recordResult(m, result(false));
    flush();

    const outbox = repo.dueOutbox(Date.now() + 1000);
    assert.equal(outbox.length, 1, "one row per alert contact");
    assert.equal(outbox[0].event, "down");

    const incident: any = getDb().prepare("SELECT * FROM incidents").get();
    assert.equal(
      outbox[0].incidentId,
      incident.id,
      "outbox row points at the incident it was written with"
    );
  });

  test("does not open a second incident while already down", () => {
    const m = repo.getMonitor(MONITOR_ID)!;
    for (let i = 0; i < 6; i++) recordResult(m, result(false));
    flush();

    assert.equal(countRows("incidents"), 1);
    assert.equal(repo.dueOutbox(Date.now() + 1000).length, 1, "alerted once, not six times");
  });

  test("recovery resolves the incident and queues an up alert", () => {
    const m = repo.getMonitor(MONITOR_ID)!;
    recordResult(m, result(false));
    recordResult(m, result(false));
    flush();

    recordResult(m, result(true));
    flush();

    const incident: any = getDb().prepare("SELECT * FROM incidents").get();
    assert.equal(incident.status, "resolved");
    assert.ok(incident.resolved_at, "resolution time recorded");
    assert.ok(incident.duration_seconds >= 0);

    const events = repo.dueOutbox(Date.now() + 1000).map((r) => r.event);
    assert.deepEqual(events, ["down", "up"]);
  });

  test("a maintenance window records the outage but pages nobody", () => {
    // A window covering every day, all day, in UTC.
    seedMonitor({
      maintenanceWindows: [
        { weekdays: [], start: "00:00", end: "23:59", timezone: "UTC" },
      ],
    });
    const m = repo.getMonitor(MONITOR_ID)!;

    recordResult(m, result(false));
    recordResult(m, result(false));
    flush();

    const incident: any = getDb().prepare("SELECT * FROM incidents").get();
    assert.equal(incident.suppressed, 1, "incident recorded for the timeline");
    assert.equal(repo.dueOutbox(Date.now() + 1000).length, 0, "but nobody is woken");
    assert.equal(repo.getMonitor(MONITOR_ID)!.inMaintenance, true);
  });

  test("an incident opened before maintenance still resolves after it", () => {
    // The regression that made maintenance a status: a monitor already down
    // when a window opened never passed through a down -> up transition, so
    // its incident stayed open forever.
    const m = repo.getMonitor(MONITOR_ID)!;
    recordResult(m, result(false));
    recordResult(m, result(false));
    flush();

    seedMonitor({
      maintenanceWindows: [
        { weekdays: [], start: "00:00", end: "23:59", timezone: "UTC" },
      ],
    });
    const inWindow = repo.getMonitor(MONITOR_ID)!;
    inWindow.status = "down";
    inWindow.consecutiveFailures = 2;

    recordResult(inWindow, result(true));
    flush();

    const incident: any = getDb().prepare("SELECT * FROM incidents").get();
    assert.equal(incident.status, "resolved", "incident does not leak past the window");
  });
});

describe("config sync", () => {
  test("re-syncing config never resets live state", () => {
    // On reconnect the Firestore listener re-delivers every document as
    // "added". If upsert reset status or failure counts, every monitor's state
    // machine would restart on each reconnect.
    const m = repo.getMonitor(MONITOR_ID)!;
    recordResult(m, result(false));
    recordResult(m, result(false));
    flush();

    assert.equal(repo.getMonitor(MONITOR_ID)!.status, "down");

    seedMonitor({ name: "Renamed site" });

    const after = repo.getMonitor(MONITOR_ID)!;
    assert.equal(after.name, "Renamed site", "config did update");
    assert.equal(after.status, "down", "live state survived");
    assert.equal(after.consecutiveFailures, 2, "failure streak survived");
  });
});

describe("heartbeat recovery", () => {
  test("a recovered heartbeat monitor comes back up once flushed", () => {
    // Regression. The /heartbeat route runs in the API process, which has no
    // flush timer — that belongs to the worker. A buffered recovery sat in
    // memory until 500 results accumulated, so a heartbeat monitor that had
    // gone down stayed red forever while its due time kept being pushed
    // forward, meaning it was never re-checked either.
    seedMonitor({ type: "heartbeat", target: "", heartbeatGraceSeconds: 300 });
    const m = repo.getMonitor(MONITOR_ID)!;

    // Two missed pings take it down.
    recordResult(m, { ...result(false), error: "No heartbeat received" });
    recordResult(m, { ...result(false), error: "No heartbeat received" });
    flush();
    assert.equal(repo.getMonitor(MONITOR_ID)!.status, "down");

    // The ping arrives. Without the explicit flush in the route, this write
    // never reached SQLite.
    const recovered = repo.getMonitor(MONITOR_ID)!;
    recordResult(recovered, result(true));
    flush();

    assert.equal(repo.getMonitor(MONITOR_ID)!.status, "up", "monitor recovers");
    const incident: any = getDb().prepare("SELECT * FROM incidents").get();
    assert.equal(incident.status, "resolved", "and its incident closes");
    assert.deepEqual(
      repo.dueOutbox(Date.now() + 1000).map((r) => r.event),
      ["down", "up"],
      "the recovery notice is queued"
    );
  });

  test("results left unflushed are invisible to the database", () => {
    // The property the bug depended on, asserted directly so nobody
    // reintroduces a buffered write on a path with no flush timer.
    const m = repo.getMonitor(MONITOR_ID)!;
    recordResult(m, result(true));
    assert.equal(
      repo.getMonitor(MONITOR_ID)!.lastCheckedAt ?? null,
      null,
      "buffered, not written"
    );
    flush();
    assert.ok(repo.getMonitor(MONITOR_ID)!.lastCheckedAt);
  });
});
