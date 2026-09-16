import { test, describe, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.UPTIMEMONK_DB = join(mkdtempSync(join(tmpdir(), "uptimemonk-hist-")), "t.db");

const { openDb, closeDb, getDb } = await import("./index.js");
const repo = await import("./repo.js");

/** The queries behind the monitor detail view. */
const MON = "m1";
const ORG = "org1";

before(() => openDb());
after(() => {
  closeDb();
  rmSync(process.env.UPTIMEMONK_DB!, { recursive: true, force: true });
});

beforeEach(() => {
  const db = getDb();
  for (const t of ["hour_buckets", "day_rollups", "incidents", "monitors"]) {
    db.prepare(`DELETE FROM ${t}`).run();
  }
});

function seedBucket(hour: string, samples: Array<{ t: number; ms: number; ok: boolean }>) {
  const up = samples.filter((s) => s.ok).length;
  getDb()
    .prepare(
      `INSERT INTO hour_buckets (monitor_id, hour, org_id, up, down, sum_ms, samples)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(MON, hour, ORG, up, samples.length - up, samples.reduce((a, s) => a + s.ms, 0),
         JSON.stringify(samples));
}

describe("dayRollupsFor", () => {
  test("returns newest first and respects the limit", () => {
    for (const day of ["20260910", "20260911", "20260912"]) {
      repo.writeDayRollup({
        monitorId: MON, orgId: ORG, day, up: 288, down: 0,
        avgMs: 120, uptimeRatio: 1, downtimeSeconds: 0,
      });
    }
    assert.deepEqual(repo.dayRollupsFor(MON).map((d) => d.day),
      ["20260912", "20260911", "20260910"]);
    assert.equal(repo.dayRollupsFor(MON, 2).length, 2);
  });

  test("a monitor with no history returns an empty list, not an error", () => {
    assert.deepEqual(repo.dayRollupsFor("never-checked"), []);
  });
});

describe("recentSamples", () => {
  test("flattens buckets into one series, oldest first", () => {
    seedBucket("2026091608", [{ t: 300, ms: 10, ok: true }, { t: 100, ms: 20, ok: true }]);
    seedBucket("2026091609", [{ t: 500, ms: 30, ok: false }]);

    const s = repo.recentSamples(MON);
    assert.deepEqual(s.map((x) => x.t), [100, 300, 500], "sorted by time across buckets");
  });

  test("downsamples a long series but keeps the newest point", () => {
    // At a 60s interval a day is 1,440 points — more than a chart can show
    // and more than is worth sending.
    const many = Array.from({ length: 1000 }, (_, i) => ({ t: i, ms: i, ok: true }));
    seedBucket("2026091610", many);

    const s = repo.recentSamples(MON, 24, 100);
    assert.ok(s.length <= 101, `expected ~100 points, got ${s.length}`);
    assert.equal(s[s.length - 1].t, 999, "the most recent sample is never dropped");
  });

  test("a malformed bucket costs one hour of chart, not the whole view", () => {
    getDb()
      .prepare(`INSERT INTO hour_buckets (monitor_id, hour, org_id, samples)
                VALUES (?, ?, ?, ?)`)
      .run(MON, "2026091611", ORG, "{not json");
    seedBucket("2026091612", [{ t: 900, ms: 5, ok: true }]);

    const s = repo.recentSamples(MON);
    assert.deepEqual(s.map((x) => x.t), [900]);
  });

  test("returns empty for a monitor that has never been checked", () => {
    assert.deepEqual(repo.recentSamples("never-checked"), []);
  });
});

describe("historySummary", () => {
  test("totals checks and averages response time", () => {
    seedBucket("2026091608", [
      { t: 1, ms: 100, ok: true },
      { t: 2, ms: 200, ok: true },
      { t: 3, ms: 300, ok: false },
    ]);
    const s = repo.historySummary(MON);
    assert.equal(s.checks, 3);
    assert.equal(s.up, 2);
    assert.equal(s.down, 1);
    assert.equal(s.avgMs, 200);
  });

  test("does not divide by zero when there is no history", () => {
    assert.deepEqual(repo.historySummary("never-checked"),
      { checks: 0, up: 0, down: 0, avgMs: 0 });
  });
});

/**
 * Deleting a monitor used to leave its buckets, rollups and incidents behind
 * forever — day_rollups and incidents are never pruned by design, so nothing
 * would ever remove them, and the orphaned incidents still appeared in the
 * dashboard's list for the org.
 */
describe("deleting a monitor removes its history", () => {
  function seedMonitorWithHistory(id: string) {
    const db = getDb();
    db.prepare(
      `INSERT INTO monitors (id, org_id, name, type, created_at, updated_at)
       VALUES (?, ?, ?, 'http', 0, 0)`
    ).run(id, ORG, `mon-${id}`);
    db.prepare(
      `INSERT INTO hour_buckets (monitor_id, hour, org_id, up, down, sum_ms, samples)
       VALUES (?, '2026091608', ?, 1, 0, 10, '[]')`
    ).run(id, ORG);
    repo.writeDayRollup({
      monitorId: id, orgId: ORG, day: "20260916", up: 1, down: 0,
      avgMs: 10, uptimeRatio: 1, downtimeSeconds: 0,
    });
    db.prepare(
      `INSERT INTO incidents (id, org_id, monitor_id, monitor_name, started_at, status)
       VALUES (?, ?, ?, 'x', 0, 'resolved')`
    ).run(`inc-${id}`, ORG, id);
    db.prepare(
      `INSERT INTO alert_outbox (incident_id, contact_id, event, next_attempt_at, created_at)
       VALUES (?, 'c1', 'down', 0, 0)`
    ).run(`inc-${id}`);
  }

  const counts = () => {
    const db = getDb();
    const n = (t: string) => (db.prepare(`SELECT COUNT(*) c FROM ${t}`).get() as any).c;
    return {
      monitors: n("monitors"), buckets: n("hour_buckets"),
      days: n("day_rollups"), incidents: n("incidents"), outbox: n("alert_outbox"),
    };
  };

  test("cascades to buckets, rollups, incidents and outbox", () => {
    seedMonitorWithHistory("del-me");
    assert.deepEqual(counts(), { monitors: 1, buckets: 1, days: 1, incidents: 1, outbox: 1 });

    repo.deleteMonitor("del-me");
    assert.deepEqual(counts(), { monitors: 0, buckets: 0, days: 0, incidents: 0, outbox: 0 });
  });

  test("leaves other monitors' history untouched", () => {
    seedMonitorWithHistory("keep");
    seedMonitorWithHistory("drop");
    repo.deleteMonitor("drop");

    const c = counts();
    assert.deepEqual(c, { monitors: 1, buckets: 1, days: 1, incidents: 1, outbox: 1 });
    assert.equal(repo.getMonitor("keep")?.id, "keep");
  });

  test("purgeOrphanedHistory clears rows stranded by the old behaviour", () => {
    seedMonitorWithHistory("stranded");
    // Simulate the pre-cascade delete: monitor row only.
    getDb().prepare("DELETE FROM monitors WHERE id = ?").run("stranded");
    assert.equal(counts().days, 1, "history survived the old delete");

    const removed = repo.purgeOrphanedHistory();
    assert.ok(removed >= 4, `expected the stranded rows to go, removed ${removed}`);
    assert.deepEqual(counts(), { monitors: 0, buckets: 0, days: 0, incidents: 0, outbox: 0 });
  });

  test("is a no-op when nothing is orphaned", () => {
    seedMonitorWithHistory("healthy");
    assert.equal(repo.purgeOrphanedHistory(), 0);
    assert.equal(counts().monitors, 1);
  });
});

/**
 * Rebalance support. Changing WORKER_COUNT moves organisations between
 * workers; the new owner has no local history, so without adoption a monitor
 * that was down restarts at "pending" and re-alerts as a fresh outage.
 */
describe("adopting state after a rebalance", () => {
  const seedBare = (id: string) =>
    getDb()
      .prepare(
        `INSERT INTO monitors (id, org_id, name, type, status, created_at, updated_at)
         VALUES (?, ?, 'Adopted', 'http', 'pending', 0, 0)`
      )
      .run(id, ORG);

  test("restores state onto a monitor with no local history", () => {
    seedBare("adopt-1");
    const applied = repo.seedStateIfUnknown("adopt-1", {
      status: "down",
      lastCheckedAt: 1_700_000_000_000,
      lastResponseTimeMs: 250,
      lastError: "Unexpected status 503",
      uptime30d: 98.5,
    });

    assert.equal(applied, true);
    const m = repo.getMonitor("adopt-1")!;
    assert.equal(m.status, "down", "does not restart at pending");
    assert.equal(m.lastError, "Unexpected status 503");
    assert.equal(m.uptime30d, 98.5);
  });

  test("never overwrites state this worker actually observed", () => {
    seedBare("adopt-2");
    repo.seedStateIfUnknown("adopt-2", { status: "up", lastCheckedAt: 1000 });

    // A second adoption must not clobber the first — or a restart would
    // resurrect stale mirror state over a real local check.
    const applied = repo.seedStateIfUnknown("adopt-2", {
      status: "down",
      lastCheckedAt: 2000,
      lastError: "stale",
    });
    assert.equal(applied, false);
    assert.equal(repo.getMonitor("adopt-2")!.status, "up");
  });

  test("adopts an open incident so its recovery still notifies", () => {
    seedBare("adopt-3");
    repo.adoptOpenIncident({
      id: "inc-adopted",
      orgId: ORG,
      monitorId: "adopt-3",
      monitorName: "Adopted",
      startedAt: 1000,
      cause: "Carried over from the previous worker",
    });

    const got = repo.getIncident("inc-adopted");
    assert.equal(got?.status, "open");
    assert.equal(got?.monitorId, "adopt-3");
  });

  test("adopting the same incident twice is harmless", () => {
    seedBare("adopt-4");
    const i = {
      id: "inc-dup", orgId: ORG, monitorId: "adopt-4",
      monitorName: "Adopted", startedAt: 1000, cause: "x",
    };
    repo.adoptOpenIncident(i);
    repo.adoptOpenIncident(i);
    assert.equal(
      (getDb().prepare("SELECT COUNT(*) c FROM incidents WHERE id='inc-dup'").get() as any).c,
      1
    );
  });

  test("hasLocalHistory distinguishes observed from adopted-blank", () => {
    seedBare("adopt-5");
    assert.equal(repo.hasLocalHistory("adopt-5"), false);
    repo.seedStateIfUnknown("adopt-5", { status: "up", lastCheckedAt: 5000 });
    assert.equal(repo.hasLocalHistory("adopt-5"), true);
  });
});

describe("incident retention", () => {
  test("prunes resolved incidents past the window but never open ones", () => {
    const db = getDb();
    const ins = (id: string, status: string, resolvedAt: number | null) =>
      db
        .prepare(
          `INSERT INTO incidents (id, org_id, monitor_id, monitor_name, started_at, status, resolved_at)
           VALUES (?, ?, 'm', 'x', 0, ?, ?)`
        )
        .run(id, ORG, status, resolvedAt);

    const old = Date.now() - 400 * 86_400_000;
    ins("old-resolved", "resolved", old);
    ins("recent-resolved", "resolved", Date.now());
    ins("ancient-open", "open", null);

    const removed = repo.pruneIncidents(Date.now() - 365 * 86_400_000);
    assert.equal(removed, 1, "only the aged, resolved one");
    assert.equal(repo.getIncident("old-resolved"), null);
    assert.ok(repo.getIncident("recent-resolved"));
    assert.ok(
      repo.getIncident("ancient-open"),
      "an unresolved outage is current state, not history"
    );
  });
});
