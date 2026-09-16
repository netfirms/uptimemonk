import { decideTransition } from "./stateMachine.js";
import { inMaintenance } from "../lib/time.js";
import {
  flushResults,
  openIncident,
  resolveOpenIncident,
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
