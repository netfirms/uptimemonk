import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import { Timestamp } from "firebase-admin/firestore";
import { db, col } from "../lib/firestore";
import { enqueueCheck, primaryRegionOf } from "../lib/queues";
import {
  DISPATCH_BATCH_SIZE,
  MAX_CLAIM_MS,
  MAX_PAGES_PER_TICK,
  PRIMARY_REGION,
} from "../config";
import { recordResult } from "../monitors/recordResult";
import type { Monitor } from "../types";

/**
 * The heartbeat of the whole system: ONE Cloud Scheduler job, firing every
 * minute, that claims every monitor whose `nextCheckAt` has passed and hands
 * each one to a regional Cloud Tasks queue.
 *
 * Why claim-then-enqueue:
 *  - Cloud Scheduler's floor is 1 minute, so the tick rate is fixed; per-monitor
 *    intervals live in Firestore rather than in cron expressions. One scheduler
 *    job ($0.10/month) covers every monitor in the system instead of one job
 *    per monitor, which is what makes this cheap.
 *  - Writing `nextCheckAt` *before* enqueueing means a retried or overlapping
 *    tick cannot double-check the same monitor.
 *  - Cloud Tasks absorbs the fan-out, so one slow target never delays anyone
 *    else's checks, and each check gets its own retry and rate limits.
 */
export const dispatchChecks = onSchedule(
  {
    schedule: "* * * * *",
    timeZone: "UTC",
    region: PRIMARY_REGION,
    timeoutSeconds: 120,
    memory: "512MiB",
    retryCount: 0, // a missed tick is corrected by the next one; never pile up
  },
  async () => {
    const now = Date.now();
    const due: Array<{ id: string; monitor: Monitor }> = [];

    // Page through everything due. A single .limit(500) query used to cap the
    // whole fleet at 500 checks a minute — ~2,500 monitors at 5-minute
    // intervals — and 500 is also Firestore's batched-write ceiling, so the
    // claim commit had no headroom either. Claim in pages of DISPATCH_BATCH_SIZE
    // and keep going until nothing is due or the tick runs out of budget.
    const deadline = now + MAX_CLAIM_MS;
    for (let page = 0; page < MAX_PAGES_PER_TICK; page++) {
      const snap = await col
        .monitors()
        .where("enabled", "==", true)
        .where("nextCheckAt", "<=", Timestamp.fromMillis(now))
        .orderBy("nextCheckAt")
        .limit(DISPATCH_BATCH_SIZE)
        .get();

      if (snap.empty) break;

      // Claim before enqueueing: a retried or overlapping tick then cannot
      // pick the same monitors up again. This is also why the next page's
      // query is re-run rather than paginated with a cursor — the claimed
      // documents have already moved out of the result set.
      const batch = db.batch();
      for (const doc of snap.docs) {
        const monitor = doc.data() as Monitor;
        const interval =
          monitor.type === "heartbeat"
            ? Math.max(60, monitor.heartbeatGraceSeconds || monitor.intervalSeconds || 300)
            : Math.max(30, monitor.intervalSeconds || 300);
        batch.update(doc.ref, {
          nextCheckAt: Timestamp.fromMillis(now + interval * 1000),
        });
        due.push({ id: doc.id, monitor });
      }
      await batch.commit();

      if (snap.size < DISPATCH_BATCH_SIZE) break;
      if (Date.now() > deadline) {
        logger.warn("dispatchChecks: claim budget exhausted, deferring rest", {
          claimed: due.length,
        });
        break;
      }
    }

    if (!due.length) {
      logger.debug("dispatchChecks: nothing due");
      return;
    }

    // 2. Fan out. Heartbeat monitors are never probed — being due IS the failure,
    //    because every received ping pushes nextCheckAt into the future.
    const probes = due.filter((d) => d.monitor.type !== "heartbeat");
    const heartbeats = due.filter((d) => d.monitor.type === "heartbeat");

    const enqueued = await Promise.allSettled(
      probes.map(({ id, monitor }) => enqueueCheck(id, primaryRegionOf(monitor)))
    );
    const failed = enqueued.filter((r) => r.status === "rejected");
    if (failed.length) {
      logger.error("dispatchChecks: some enqueues failed", {
        failed: failed.length,
        sample: (failed[0] as PromiseRejectedResult).reason?.message,
      });
    }

    await Promise.allSettled(
      heartbeats.map(({ id, monitor }) =>
        recordResult(id, monitor, {
          ok: false,
          responseTimeMs: 0,
          error: `No heartbeat received within ${
            monitor.heartbeatGraceSeconds ?? monitor.intervalSeconds
          }s`,
          region: PRIMARY_REGION,
          checkedAt: now,
        })
      )
    );

    logger.info("dispatchChecks", {
      due: due.length,
      probes: probes.length,
      heartbeats: heartbeats.length,
      failedEnqueues: failed.length,
    });
  }
);
