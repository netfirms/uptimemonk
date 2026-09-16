import { test, describe, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.UPTIMEMONK_DB = join(mkdtempSync(join(tmpdir(), "uptimemonk-series-")), "t.db");

const { openDb, closeDb, getDb } = await import("../db/index.js");
const { seriesFor, sinceHourFor } = await import("./series.js");
const { parseRange, RANGES } = await import("../lib/ranges.js");

const MON = "m1";
const ORG = "org1";
/** 2026-09-16T12:00:00Z — fixed, so "how many days back" is not a moving part. */
const NOW = Date.UTC(2026, 8, 16, 12);

before(() => openDb());
after(() => {
  closeDb();
  rmSync(process.env.UPTIMEMONK_DB!, { recursive: true, force: true });
});
beforeEach(() => {
  for (const t of ["hour_buckets", "day_rollups"]) getDb().prepare(`DELETE FROM ${t}`).run();
});

function seedHours(n: number) {
  const stmt = getDb().prepare(
    `INSERT INTO hour_buckets (monitor_id, hour, org_id, up, down, sum_ms, samples)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  for (let i = 0; i < n; i++) {
    const at = NOW - i * 3_600_000;
    const d = new Date(at);
    const key =
      `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}` +
      `${String(d.getUTCDate()).padStart(2, "0")}${String(d.getUTCHours()).padStart(2, "0")}`;
    stmt.run(MON, key, ORG, 10, 0, 1000, JSON.stringify([{ t: at, ms: 100, ok: true }]));
  }
}

function seedDays(n: number) {
  const stmt = getDb().prepare(
    `INSERT INTO day_rollups
       (monitor_id, day, org_id, up, down, avg_ms, uptime_ratio, downtime_seconds)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0)`
  );
  for (let i = 0; i < n; i++) {
    const d = new Date(NOW - i * 86_400_000);
    const key =
      `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}` +
      `${String(d.getUTCDate()).padStart(2, "0")}`;
    stmt.run(MON, key, ORG, 100, 0, 150, 1);
  }
}

describe("range parsing", () => {
  test("the four offered windows are accepted", () => {
    for (const k of ["24h", "7d", "30d", "90d"]) assert.equal(parseRange(k), k);
  });

  test("anything else falls back rather than erroring", () => {
    // A bad value in a URL should still render a chart.
    for (const bad of ["", "1y", "abc", null, undefined, "7D"]) {
      assert.equal(parseRange(bad), "24h");
    }
  });
});

describe("seriesFor", () => {
  test("short ranges read hourly buckets", () => {
    seedHours(200);
    assert.equal(seriesFor(MON, "24h").granularity, "hour");
    assert.equal(seriesFor(MON, "24h").buckets.length, 24);
    assert.equal(seriesFor(MON, "7d").buckets.length, 168);
  });

  test("long ranges read daily rollups", () => {
    seedDays(120);
    assert.equal(seriesFor(MON, "30d").granularity, "day");
    assert.equal(seriesFor(MON, "30d").buckets.length, 30);
    assert.equal(seriesFor(MON, "90d").buckets.length, 90);
  });

  test("a long range does not fall back to the pruned bucket table", () => {
    // Buckets are pruned at RETENTION_DAYS (35). If 90d read them it would
    // silently show a third of the window it claims to.
    seedHours(200);
    assert.deepEqual(seriesFor(MON, "90d").buckets, []);
  });

  test("buckets run oldest first, so bars render left to right", () => {
    seedHours(24);
    const ts = seriesFor(MON, "24h").buckets.map((b) => b.t);
    assert.deepEqual([...ts].sort((a, b) => a - b), ts);
  });

  test("a long range charts the daily average, since no samples survive", () => {
    seedDays(40);
    const s = seriesFor(MON, "30d");
    assert.equal(s.points.length, 30);
    assert.ok(s.points.every((p) => p.ms === 150));
  });

  test("timestamps are real instants, not string keys", () => {
    seedDays(2);
    const [first] = seriesFor(MON, "30d").buckets;
    assert.ok(Number.isFinite(first.t));
    assert.equal(new Date(first.t).getUTCHours(), 0);
  });
});

describe("sinceHourFor", () => {
  test("scopes a summary to the window being charted", () => {
    assert.equal(sinceHourFor("24h", NOW), "2026091512");
    assert.equal(sinceHourFor("90d", NOW), "2026061812");
  });

  test("every range produces a key the bucket query can compare", () => {
    for (const k of Object.keys(RANGES)) {
      assert.match(sinceHourFor(k as never, NOW), /^\d{10}$/);
    }
  });
});
