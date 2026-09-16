/**
 * The time windows a chart can show.
 *
 * Which table answers a range is not a free choice. `hour_buckets` carries the
 * individual samples and is pruned at RETENTION_DAYS (35), so it can only
 * answer the short windows; `day_rollups` is kept far longer but has one
 * average per day. Asking for 90 days of raw samples would return a third of
 * the window and parse ~2,000 JSON blobs to do it.
 *
 * So the short ranges read buckets and the long ones read rollups, and the
 * bucket size below is what a single bar or point covers.
 */
export const RANGES = {
  "24h": { hours: 24, days: 1, granularity: "hour" },
  "7d": { hours: 168, days: 7, granularity: "hour" },
  "30d": { hours: 0, days: 30, granularity: "day" },
  "90d": { hours: 0, days: 90, granularity: "day" },
} as const;

export type RangeKey = keyof typeof RANGES;

export const DEFAULT_RANGE: RangeKey = "24h";

/** Anything unrecognised falls back rather than erroring: a chart is not worth
 *  a 400, and a bad value in a URL should still render something. */
export function parseRange(raw: unknown): RangeKey {
  const key = String(raw ?? "");
  return key in RANGES ? (key as RangeKey) : DEFAULT_RANGE;
}
