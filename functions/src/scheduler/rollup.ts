import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import { Timestamp } from "firebase-admin/firestore";
import { db, col } from "../lib/firestore";
import { dayKey, dayKeysBack } from "../lib/time";
import { PRIMARY_REGION } from "../config";
import type { DayRollup, HourBucket, Monitor } from "../types";

/**
 * Nightly compaction: 24 hour-buckets → 1 day document, plus the denormalised
 * 24h/7d/30d uptime numbers the dashboard and status pages read.
 *
 * This is what keeps status pages cheap: a 90-day uptime bar is 90 tiny reads
 * from `days`, not 25,920 raw check documents. The hour buckets expire on their
 * own via a Firestore TTL policy on `expiresAt`.
 */
export const rollupDaily = onSchedule(
  {
    schedule: "15 0 * * *", // 00:15 UTC, after the day closes
    timeZone: "UTC",
    region: PRIMARY_REGION,
    timeoutSeconds: 540,
    memory: "512MiB",
  },
  async () => {
    const yesterday = Date.now() - 86_400_000;
    const day = dayKey(yesterday);

    let processed = 0;
    let lastId: string | null = null;

    // Page through monitors so this scales past a single query's memory.
    for (;;) {
      let q = col.monitors().orderBy("__name__").limit(200);
      if (lastId) q = q.startAfter(lastId);
      const snap = await q.get();
      if (snap.empty) break;

      await Promise.all(
        snap.docs.map(async (doc) => {
          await rollupMonitorDay(doc.id, doc.data() as Monitor, day);
          processed++;
        })
      );

      lastId = snap.docs[snap.docs.length - 1].id;
      if (snap.size < 200) break;
    }

    logger.info("rollupDaily complete", { day, processed });
  }
);

async function rollupMonitorDay(
  monitorId: string,
  monitor: Monitor,
  day: string
): Promise<void> {
  const buckets = await col
    .buckets(monitorId)
    .where("hour", ">=", `${day}00`)
    .where("hour", "<=", `${day}23`)
    .get();

  if (buckets.empty) return;

  let up = 0;
  let down = 0;
  let sumMs = 0;
  for (const b of buckets.docs) {
    const data = b.data() as HourBucket;
    up += data.up ?? 0;
    down += data.down ?? 0;
    sumMs += data.sumMs ?? 0;
  }
  const total = up + down;
  if (!total) return;

  const rollup: DayRollup = {
    monitorId,
    orgId: monitor.orgId,
    day,
    up,
    down,
    avgMs: Math.round(sumMs / total),
    uptimeRatio: up / total,
    downtimeSeconds: down * (monitor.intervalSeconds || 300),
  };
  await col.days(monitorId).doc(day).set(rollup);

  // Trailing uptime windows, read straight off the day docs we just wrote.
  const [u1, u7, u30] = await Promise.all([
    trailingUptime(monitorId, 1),
    trailingUptime(monitorId, 7),
    trailingUptime(monitorId, 30),
  ]);
  await col.monitor(monitorId).update({
    uptime24h: u1,
    uptime7d: u7,
    uptime30d: u30,
    updatedAt: Timestamp.now(),
  });
}

async function trailingUptime(monitorId: string, days: number): Promise<number> {
  const keys = dayKeysBack(Date.now() - 86_400_000, days);
  const refs = keys.map((k) => col.days(monitorId).doc(k));
  const snaps = await db.getAll(...refs);

  let up = 0;
  let total = 0;
  for (const s of snaps) {
    if (!s.exists) continue;
    const d = s.data() as DayRollup;
    up += d.up;
    total += d.up + d.down;
  }
  return total ? Number(((up / total) * 100).toFixed(4)) : 100;
}
