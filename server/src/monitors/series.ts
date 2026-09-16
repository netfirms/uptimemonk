import { dayRollupsFor, hourBucketsFor, recentSamples } from "../db/repo.js";
import { hourKey, keyToMs } from "../lib/time.js";
import { RANGES, type RangeKey } from "../lib/ranges.js";

/**
 * The chart data for one monitor over one range.
 *
 * Shared by the dashboard's history endpoint and the public status page so the
 * two cannot disagree about what "last 7 days" means — they did diverge once
 * already, when the status page was reading a Firestore subcollection that the
 * dashboard had stopped writing.
 *
 * Every bucket carries an epoch timestamp rather than a formatted label. The
 * keys in SQLite are UTC, and a pre-formatted label would show the wrong hour
 * to most of the world; the client formats in the viewer's own timezone.
 */

export interface Bucket {
  /** Start of the bucket, epoch ms UTC. */
  t: number;
  up: number;
  down: number;
  avgMs: number;
  uptimeRatio: number;
}

export interface Point {
  t: number;
  ms: number;
  ok: boolean;
  /** Only on hourly ranges — a daily average has no single status code. */
  code?: number;
}

export interface Series {
  range: RangeKey;
  granularity: "hour" | "day";
  buckets: Bucket[];
  points: Point[];
}

/** A day counts as "up" for charting when it lost no more than 0.1% of checks —
 *  the same threshold the uptime bars use, kept here so they agree. */
const DAY_OK = 0.999;

export function seriesFor(monitorId: string, range: RangeKey): Series {
  const spec = RANGES[range];

  if (spec.granularity === "hour") {
    const buckets = hourBucketsFor(monitorId, spec.hours).map((b) => ({
      t: keyToMs(b.hour),
      up: b.up,
      down: b.down,
      avgMs: b.avgMs,
      uptimeRatio: b.uptimeRatio,
    }));
    return {
      range,
      granularity: "hour",
      buckets,
      // Individual checks, which only exist inside the bucket retention window.
      points: recentSamples(monitorId, spec.hours).map((s) => ({
        t: s.t,
        ms: s.ms,
        ok: s.ok,
        code: s.code,
      })),
    };
  }

  const rollups = dayRollupsFor(monitorId, spec.days).reverse();
  const buckets = rollups.map((r) => ({
    t: keyToMs(r.day),
    up: r.up,
    down: r.down,
    avgMs: r.avgMs,
    uptimeRatio: r.uptimeRatio,
  }));

  return {
    range,
    granularity: "day",
    buckets,
    // One point per day. There is no raw sample data this far back — buckets
    // are pruned well before 90 days — so the daily average is the series.
    points: buckets.map((b) => ({ t: b.t, ms: b.avgMs, ok: b.uptimeRatio >= DAY_OK })),
  };
}

/** The first hour key inside a range, for scoping a summary to it. */
export function sinceHourFor(range: RangeKey, now = Date.now()): string {
  const spec = RANGES[range];
  const ms = spec.granularity === "hour" ? spec.hours * 3_600_000 : spec.days * 86_400_000;
  return hourKey(now - ms);
}
