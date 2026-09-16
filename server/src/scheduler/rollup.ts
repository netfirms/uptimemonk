import {
  bucketsForDay,
  getMonitor,
  listMonitors,
  pruneBuckets,
  setUptimes,
  trailingUptime,
  writeDayRollup,
} from "../db/repo.js";
import { dayKey, dayKeysBack, hourKey } from "../lib/time.js";
import { markOrgDirty } from "../sync/mirror.js";
import { getDb } from "../db/index.js";
import { log } from "../lib/log.js";
import { RETENTION_DAYS } from "../config.js";

/**
 * Nightly compaction and retention.
 *
 * Hour buckets become one tiny day row, then buckets older than the retention
 * window are deleted. Day rollups are a few dozen bytes each and are kept
 * indefinitely — they are what a 90-day status bar reads.
 */
export function runDailyRollup(now = Date.now()): void {
  const yesterday = now - 86_400_000;
  const day = dayKey(yesterday);

  const totals = bucketsForDay(day);
  const db = getDb();

  db.transaction(() => {
    for (const [monitorId, t] of totals) {
      const total = t.up + t.down;
      if (!total) continue;
      const monitor = getMonitor(monitorId);
      writeDayRollup({
        monitorId,
        orgId: t.orgId,
        day,
        up: t.up,
        down: t.down,
        avgMs: Math.round(t.sumMs / total),
        uptimeRatio: t.up / total,
        // Each failed check stands for one interval of downtime.
        downtimeSeconds: t.down * (monitor?.intervalSeconds ?? 300),
      });
    }
  })();

  // Trailing windows, read back off the rows just written.
  for (const monitor of listMonitors()) {
    const u24 = trailingUptime(monitor.id, dayKeysBack(yesterday, 1));
    const u7 = trailingUptime(monitor.id, dayKeysBack(yesterday, 7));
    const u30 = trailingUptime(monitor.id, dayKeysBack(yesterday, 30));
    setUptimes(monitor.id, u24, u7, u30);
    markOrgDirty(monitor.orgId, false);
  }

  const cutoff = `${dayKey(now - RETENTION_DAYS * 86_400_000)}00`;
  const pruned = pruneBuckets(cutoff);

  // Incremental rather than a full VACUUM, which rewrites the entire file and
  // needs free disk equal to the database.
  try {
    getDb().pragma("incremental_vacuum");
  } catch (err) {
    log.warn({ err }, "incremental_vacuum failed (harmless)");
  }

  log.info(
    { day, monitors: totals.size, prunedBuckets: pruned, cutoffHour: cutoff },
    "daily rollup complete"
  );
}

/**
 * Schedule the rollup for just after midnight UTC, then every 24 hours.
 * Checking hourly rather than computing one long timeout means a suspended or
 * clock-adjusted box still catches up.
 */
export function startRollupLoop(): NodeJS.Timeout {
  let lastRunDay = "";
  const timer = setInterval(() => {
    const now = Date.now();
    const hour = hourKey(now).slice(-2);
    const today = dayKey(now);
    if (hour === "00" && today !== lastRunDay) {
      lastRunDay = today;
      try {
        runDailyRollup(now);
      } catch (err) {
        log.error({ err }, "daily rollup failed");
      }
    }
  }, 10 * 60_000);
  timer.unref();
  return timer;
}
