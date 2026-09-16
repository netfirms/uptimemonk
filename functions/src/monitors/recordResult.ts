import { logger } from "firebase-functions";
import { Timestamp, FieldValue } from "firebase-admin/firestore";
import { db, col } from "../lib/firestore";
import { hourKey, inMaintenance } from "../lib/time";
import { enqueueAlert } from "../lib/queues";
import { decideTransition } from "./stateMachine";
import { RAW_SAMPLE_RETENTION_DAYS } from "../config";
import type { CheckResult, Incident, Monitor, MonitorStatus } from "../types";

/**
 * Persist one check result and run the up/down state machine.
 *
 * Cost note — this is the hot path, so it is deliberately TWO writes per check:
 *   1. the monitor document (live state for the dashboard)
 *   2. the current hour's bucket (samples + counters for charts)
 * Incident documents are only written on a transition, which is rare.
 * At a 5-minute interval that is 288 checks/day → 576 writes/day/monitor.
 */
export async function recordResult(
  monitorId: string,
  monitor: Monitor,
  result: CheckResult
): Promise<void> {
  const now = result.checkedAt;
  const suppressed = inMaintenance(monitor.maintenanceWindows, now);
  const prevStatus: MonitorStatus = monitor.status ?? "pending";

  // Maintenance suppresses *alerting*, not the state machine. Treating it as a
  // status of its own meant a monitor that was already down when a window
  // opened came out the other side as "up" without ever passing through a
  // down -> up transition: the open incident was never resolved, and the
  // customer never got the recovery notice.
  const {
    status: nextStatus,
    failures,
    transitionedDown,
    transitionedUp,
  } = decideTransition({
    previousStatus: prevStatus,
    previousFailures: monitor.consecutiveFailures,
    ok: result.ok,
    threshold: monitor.confirmationThreshold,
  });

  // ---- write 1: live monitor state ----
  const monitorUpdate: Record<string, unknown> = {
    status: nextStatus,
    lastCheckedAt: Timestamp.fromMillis(now),
    lastResponseTimeMs: result.responseTimeMs,
    lastError: result.error ?? null,
    consecutiveFailures: failures,
    inMaintenance: suppressed,
    updatedAt: Timestamp.fromMillis(now),
  };
  if (nextStatus !== prevStatus) {
    monitorUpdate.lastStatusChangedAt = Timestamp.fromMillis(now);
  }
  const certExpiresAt = result.meta?.expiresAt;
  if (typeof certExpiresAt === "number") {
    monitorUpdate.certExpiresAt = Timestamp.fromMillis(certExpiresAt);
  }

  // ---- write 2: hourly bucket ----
  const bucketRef = col.buckets(monitorId).doc(hourKey(now));
  const sample = {
    t: now,
    ms: result.responseTimeMs,
    ok: result.ok,
    ...(result.statusCode ? { code: result.statusCode } : {}),
  };

  const batch = db.batch();
  batch.update(col.monitor(monitorId), monitorUpdate);
  batch.set(
    bucketRef,
    {
      monitorId,
      orgId: monitor.orgId,
      hour: hourKey(now),
      up: FieldValue.increment(result.ok ? 1 : 0),
      down: FieldValue.increment(result.ok ? 0 : 1),
      sumMs: FieldValue.increment(result.responseTimeMs),
      // No max() transform exists in Firestore and a read-then-write would
      // double the cost of the hot path, so p95/max are derived from `samples`
      // at read time instead.
      samples: FieldValue.arrayUnion(sample),
      expiresAt: Timestamp.fromMillis(
        now + RAW_SAMPLE_RETENTION_DAYS * 86_400_000
      ),
    },
    { merge: true }
  );
  await batch.commit();

  if (!transitionedDown && !transitionedUp) return;

  // ---- transitions (rare) ----
  if (transitionedDown) {
    const incident: Incident = {
      orgId: monitor.orgId,
      monitorId,
      monitorName: monitor.name,
      startedAt: Timestamp.fromMillis(now),
      resolvedAt: null,
      cause: result.error ?? "Check failed",
      confirmedBy: [result.region],
      status: "open",
      suppressed,
      acknowledgedBy: null,
    };
    const ref = await col.incidents().add(incident);
    logger.warn("monitor down", { monitorId, cause: incident.cause });
    if (!suppressed) {
      await enqueueAlert({
        orgId: monitor.orgId,
        monitorId,
        incidentId: ref.id,
        event: "down",
      });
    }
    return;
  }

  // transitionedUp — close the open incident, if any
  const open = await col
    .incidents()
    .where("monitorId", "==", monitorId)
    .where("status", "==", "open")
    .orderBy("startedAt", "desc")
    .limit(1)
    .get();

  if (open.empty) return;
  const doc = open.docs[0];
  const startedAt = (doc.data() as Incident).startedAt.toMillis();
  await doc.ref.update({
    status: "resolved",
    resolvedAt: Timestamp.fromMillis(now),
    durationSeconds: Math.round((now - startedAt) / 1000),
  });
  logger.info("monitor recovered", { monitorId, downForSeconds: (now - startedAt) / 1000 });

  if (!suppressed) {
    await enqueueAlert({
      orgId: monitor.orgId,
      monitorId,
      incidentId: doc.id,
      event: "up",
    });
  }
}
