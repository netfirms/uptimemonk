import { burnDay } from "../lib/credits.js";
import {
  bucketsForDay,
  checksOnDay,
  getMonitor,
  getOrgCredit,
  listMonitors,
  orgsWithUsageOn,
  postCredit,
  pruneBuckets,
  pruneIncidents,
  setDonationState,
  setUptimes,
  trailingUptime,
  writeDayRollup,
} from "../db/repo.js";
import { dayKey, dayKeysBack, hourKey } from "../lib/time.js";
import { markOrgDirty } from "../sync/mirror.js";
import { getDb } from "../db/index.js";
import { log } from "../lib/log.js";
import { INCIDENT_RETENTION_DAYS, RETENTION_DAYS } from "../config.js";

/**
 * Nightly compaction and retention.
 *
 * Hour buckets become one tiny day row, then buckets older than the retention
 * window are deleted. Day rollups are a few dozen bytes each and are kept
 * indefinitely — they are what a 90-day status bar reads.
 */

/**
 * Charge each org for yesterday's checks.
 *
 * Runs off `day_rollups`, which the compaction above has just written, so the
 * figure charged is what was actually probed rather than what was configured —
 * a monitor paused halfway through the day costs half a day.
 *
 * Idempotent by construction: the movement is posted to the ledger with the
 * day as its `ref`, and `UNIQUE (reason, ref)` means a second run inserts
 * nothing. A worker restart between the rollup and the burn used to be able to
 * charge the same day twice, and a donor would lose credit to an operational
 * accident with no record of why.
 */
function burnYesterday(day: string): number {
  let charged = 0;

  for (const orgId of orgsWithUsageOn(day)) {
    const before = getOrgCredit(orgId);
    const after = burnDay(before, checksOnDay(orgId, day));
    const delta = after.credits - before.credits;
    if (delta === 0) continue;

    const posted = postCredit({ orgId, delta, reason: "burn", ref: day });
    if (!posted) continue;
    charged++;

    // Opening the window is state, not a movement, so it is set alongside.
    if (posted.balance === 0 && before.credits > 0) {
      setDonationState(orgId, { graceUntil: after.graceUntil });
      log.warn(
        { orgId, graceUntil: after.graceUntil },
        "org is out of donation credit — grace period started"
      );
    }
  }

  return charged;
}

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

  // `yesterday` is a timestamp here; the burn is keyed by day string.
  const burned = burnYesterday(dayKey(yesterday));

  const cutoff = `${dayKey(now - RETENTION_DAYS * 86_400_000)}00`;
  const pruned = pruneBuckets(cutoff);

  // Resolved incidents are kept far longer than raw samples — they are the
  // record customers refer back to — but not forever. Open ones are never
  // removed: an unresolved outage is current state, not history.
  const prunedIncidents = pruneIncidents(now - INCIDENT_RETENTION_DAYS * 86_400_000);

  // Incremental rather than a full VACUUM, which rewrites the entire file and
  // needs free disk equal to the database.
  try {
    getDb().pragma("incremental_vacuum");
  } catch (err) {
    log.warn({ err }, "incremental_vacuum failed (harmless)");
  }

  log.info(
    { day, monitors: totals.size, orgsCharged: burned, prunedBuckets: pruned, prunedIncidents, cutoffHour: cutoff },
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
