import { decideTransition } from "./stateMachine.js";
import { certCause, decideCertAlerts } from "./certWatch.js";
import { inMaintenance } from "../lib/time.js";
import {
  flushResults,
  openCertNotice,
  openIncident,
  resolveOpenIncident,
  setCertAlertState,
  type PendingWrite,
} from "../db/repo.js";
import { markOrgDirty } from "../sync/mirror.js";
import { log } from "../lib/log.js";
import { DB_FLUSH_MS } from "../config.js";
import type { CheckResult, Monitor } from "../types.js";

/**
 * Applies the up/down state machine and buffers the write.
 *
 * Nothing here touches SQLite directly. Results accumulate in memory and are
 * written by `flush()` in a single transaction, because better-sqlite3 is
 * synchronous and a per-probe write would hand the event loop a syscall in the
 * middle of 200 concurrent sockets.
 *
 * Incidents are the exception: they are rare, and they are the one thing that
 * must be durable the instant it happens, so they write through immediately
 * alongside their outbox rows.
 */

let buffer: PendingWrite[] = [];
let timer: NodeJS.Timeout | null = null;

/**
 * Raise any newly-crossed expiry threshold, once.
 *
 * Suppressed during maintenance for the same reason an outage is: the customer
 * already knows, and this is not the moment.
 */
function noteCertificate(
  monitor: Monitor,
  expiresAt: number,
  result: CheckResult
): void {
  const decision = decideCertAlerts(monitor, expiresAt, result.checkedAt);

  // Persist even when nothing fires: a renewal clears the record, and that
  // has to stick or the new certificate inherits the old one's silence.
  if (
    decision.renewed ||
    decision.alertedDays.length !== (monitor.certAlertedDays ?? []).length ||
    monitor.certAlertBasis !== expiresAt
  ) {
    monitor.certAlertedDays = decision.alertedDays;
    monitor.certAlertBasis = decision.basis;
    setCertAlertState(monitor.id, decision.alertedDays, decision.basis);
  }

  if (!decision.fire.length || monitor.inMaintenance) return;

  const daysLeft = Math.floor((expiresAt - result.checkedAt) / 86_400_000);
  const issuer = (result.meta as { issuer?: string } | undefined)?.issuer;
  const cause = certCause(daysLeft, issuer);

  const incidentId = openCertNotice(monitor, cause, result.checkedAt);
  log.warn({ monitorId: monitor.id, incidentId, daysLeft }, "certificate expiry warning");
  markOrgDirty(monitor.orgId, true);
}

export function recordResult(monitor: Monitor, result: CheckResult): void {
  const suppressed = inMaintenance(monitor.maintenanceWindows, result.checkedAt);

  const { status, failures, transitionedDown, transitionedUp } = decideTransition({
    previousStatus: monitor.status,
    previousFailures: monitor.consecutiveFailures,
    ok: result.ok,
    threshold: monitor.confirmationThreshold,
  });

  buffer.push({
    monitor,
    result,
    status,
    failures,
    suppressed,
    statusChanged: status !== monitor.status,
  });

  // Keep the in-memory copy current so a second check in the same flush window
  // sees the updated failure count rather than re-deciding from stale state.
  monitor.status = status;
  monitor.consecutiveFailures = failures;
  monitor.inMaintenance = suppressed;
  monitor.lastCheckedAt = result.checkedAt;
  monitor.lastResponseTimeMs = result.responseTimeMs;
  monitor.lastError = result.error ?? null;

  if (transitionedDown) {
    const incidentId = openIncident(
      monitor,
      result.error ?? "Check failed",
      result.region,
      result.checkedAt,
      suppressed
    );
    log.warn(
      { monitorId: monitor.id, incidentId, cause: result.error, suppressed },
      "monitor down"
    );
    // An outage must reach the dashboard now, not at the next routine flush.
    markOrgDirty(monitor.orgId, true);
  } else if (transitionedUp) {
    const incidentId = resolveOpenIncident(monitor, result.checkedAt, suppressed);
    log.info({ monitorId: monitor.id, incidentId }, "monitor recovered");
    markOrgDirty(monitor.orgId, true);
  } else {
    markOrgDirty(monitor.orgId, false);
  }

  /**
   * Certificate warnings ride alongside the up/down decision rather than
   * through it. The monitor is up — the site serves fine — so nothing above
   * has anything to say about a certificate with nine days left.
   */
  const expiresAt = (result.meta as { expiresAt?: number } | undefined)?.expiresAt;
  if (typeof expiresAt === "number" && Number.isFinite(expiresAt)) {
    noteCertificate(monitor, expiresAt, result);
  }

  if (buffer.length >= 500) flush();
}

/** Write everything buffered so far. Safe to call at any time. */
export function flush(): void {
  if (!buffer.length) return;
  const batch = buffer;
  buffer = [];
  try {
    flushResults(batch);
  } catch (err) {
    log.error({ err, count: batch.length }, "failed to flush check results");
  }
}

export function startFlushLoop(): void {
  if (timer) return;
  timer = setInterval(flush, DB_FLUSH_MS);
  timer.unref();
}

export function stopFlushLoop(): void {
  if (timer) clearInterval(timer);
  timer = null;
  flush(); // never exit holding unwritten results
}

export function bufferedCount(): number {
  return buffer.length;
}
