import { DueHeap, initialDueAt, nextDueAt } from "./heap.js";
import { Pool } from "../probe/pool.js";
import { runProbe } from "../checks/index.js";
import { recordResult } from "../monitors/recordResult.js";
import { getMonitor, listMonitors, setDueAt } from "../db/repo.js";
import { verifyWithPeer } from "../probe/verify.js";
import { ownsOrg } from "./assignment.js";
import { log } from "../lib/log.js";
import {
  PROBE_CONCURRENCY,
  REGION,
  WORKER_COUNT,
  WORKER_ID,
  WORKER_INDEX,
} from "../config.js";
import type { Monitor } from "../types.js";

/**
 * Absolute floor, below the tightest plan. A guard against a bad config value,
 * not a product limit — the plan floors live in lib/plans.ts.
 *
 * Capacity note for 5-second checks: one monitor at 5s is 17,280 checks a day,
 * twelve times a 1-minute monitor. The probe pool is I/O-bound so concurrency
 * is rarely the binding constraint, but the hour bucket's sample array grows to
 * 720 entries per monitor per hour. Watch queue depth and database size before
 * selling 5-second checks at volume on a 414 MB instance.
 */
const MIN_INTERVAL_SECONDS = 5;

/**
 * The check loop.
 *
 * One heap, one timer. This is what Cloud Scheduler, Cloud Tasks, the
 * dispatcher and the three regional workers collapse into — and unlike the
 * scheduler it replaces, it has no 60-second floor, which is the whole
 * commercial reason the worker fleet exists.
 */
export class Scheduler {
  private readonly heap = new DueHeap();
  private readonly pool = new Pool(PROBE_CONCURRENCY);
  private running = false;
  private loopHandle: NodeJS.Timeout | null = null;
  /** Monitors currently being probed — never schedule a second run. */
  private inFlight = new Set<string>();

  get queueDepth(): number {
    return this.pool.depth;
  }

  get scheduled(): number {
    return this.heap.size;
  }

  /**
   * Age of the oldest overdue check. This — not process liveness — is what
   * /healthz reports: a wedged scheduler inside a perfectly healthy process is
   * the failure that actually happens, and a liveness probe cannot see it.
   */
  lagMs(now = Date.now()): number {
    const next = this.heap.peek();
    if (!next) return 0;
    return Math.max(0, now - next.dueAt);
  }

  /** Load every enabled monitor for this region, preserving persisted due times. */
  load(): void {
    const now = Date.now();
    let count = 0;
    for (const m of listMonitors()) {
      if (!this.owns(m)) continue;
      const intervalMs = this.intervalMsOf(m);
      // A persisted due time in the future survives a restart; anything else
      // gets a fresh jittered slot so a deploy cannot stampede the fleet.
      const dueAt = m.dueAt > now ? m.dueAt : initialDueAt(m.id, intervalMs, now);
      this.heap.push({ id: m.id, dueAt, intervalMs });
      count++;
    }
    log.info(
      { scheduled: count, worker: WORKER_ID, shard: `${WORKER_INDEX + 1}/${WORKER_COUNT}` },
      "scheduler loaded"
    );
  }

  /** Re-read specific monitors after a config change. */
  refresh(ids: string[], removed: string[] = []): void {
    for (const id of removed) this.heap.remove(id);

    const now = Date.now();
    for (const id of ids) {
      const m = getMonitor(id);
      if (!m || !this.owns(m)) {
        this.heap.remove(id);
        continue;
      }
      const intervalMs = this.intervalMsOf(m);
      const current = this.heap.peekEntry(id);

      if (!current) {
        // New to this worker: give it a jittered first slot so a batch of
        // arrivals does not all fire on the same second.
        this.heap.push({ id, dueAt: initialDueAt(id, intervalMs, now), intervalMs });
        continue;
      }

      if (current.intervalMs === intervalMs) continue; // nothing to do

      // The interval changed. The heap entry has to be rewritten, or the new
      // value is not read until the ALREADY-SCHEDULED check fires — so moving
      // a monitor from hourly to every minute appeared to do nothing for up to
      // an hour.
      //
      // Bring the next check forward when shortening, but never push it further
      // out when lengthening: the check that is already due should still happen,
      // and only the one after it uses the longer gap. Deliberately not
      // re-jittered — that would drag the whole fleet toward whenever people
      // happen to edit things.
      const dueAt = Math.min(current.dueAt, now + intervalMs);
      this.heap.push({ id, dueAt, intervalMs });
      setDueAt(id, dueAt);
      log.info(
        { monitorId: id, fromMs: current.intervalMs, toMs: intervalMs, dueInMs: dueAt - now },
        "interval changed, rescheduled"
      );
    }
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.tick();
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.loopHandle) clearTimeout(this.loopHandle);
    await this.pool.drain();
  }

  /**
   * Does this worker own the monitor?
   *
   * Sharded by organisation so an org is never split across workers — the
   * status mirror is one document per org, and two workers writing it would
   * break the one-writer rule the architecture depends on.
   */
  private owns(m: Monitor): boolean {
    if (!m.enabled) return false;
    return ownsOrg(m.orgId, m.regions?.[0], {
      region: REGION,
      index: WORKER_INDEX,
      count: WORKER_COUNT,
    });
  }

  private intervalMsOf(m: Monitor): number {
    // A heartbeat monitor's "interval" is its grace period: being due is the
    // failure, so the clock that matters is how long silence is tolerated.
    const seconds =
      m.type === "heartbeat"
        ? Math.max(60, m.heartbeatGraceSeconds || m.intervalSeconds || 300)
        : Math.max(MIN_INTERVAL_SECONDS, m.intervalSeconds || 300);
    return seconds * 1000;
  }

  private tick(): void {
    if (!this.running) return;

    const now = Date.now();
    for (const due of this.heap.popDue(now)) {
      const monitor = getMonitor(due.id);
      if (!monitor || !this.owns(monitor)) continue;

      // Re-read the interval: a config change may have altered it since the
      // entry was pushed.
      const intervalMs = this.intervalMsOf(monitor);
      const advanced = nextDueAt(due.dueAt, intervalMs, now);
      this.heap.push({ id: due.id, dueAt: advanced, intervalMs });
      setDueAt(due.id, advanced);

      if (this.inFlight.has(due.id)) {
        log.warn({ monitorId: due.id }, "check still running, skipping this slot");
        continue;
      }

      this.inFlight.add(due.id);
      this.pool.submit(
        () => this.check(monitor),
        (err) => log.error({ err, monitorId: due.id }, "probe crashed")
      );
    }

    // Sleep exactly until the next monitor is due, capped so config changes
    // and shutdown are noticed promptly.
    const next = this.heap.peek();
    const delay = next ? Math.min(1000, Math.max(0, next.dueAt - Date.now())) : 1000;
    this.loopHandle = setTimeout(() => this.tick(), delay);
    this.loopHandle.unref();
  }

  private async check(monitor: Monitor): Promise<void> {
    try {
      if (monitor.type === "heartbeat") {
        // Nothing to probe: the ping endpoint pushes due_at forward, so
        // arriving here at all means the ping never came.
        recordResult(monitor, {
          ok: false,
          responseTimeMs: 0,
          error: `No heartbeat received within ${
            monitor.heartbeatGraceSeconds ?? monitor.intervalSeconds
          }s`,
          region: REGION,
          checkedAt: Date.now(),
        });
        return;
      }

      let result = await runProbe(monitor, REGION);

      // Cross-region confirmation: only a failure seen from two places becomes
      // an incident. This kills the single largest source of false alarms —
      // a network blip between one probe and the target.
      if (!result.ok) {
        const confirmation = await verifyWithPeer(monitor);
        if (confirmation === "healthy") {
          log.info(
            { monitorId: monitor.id },
            "peer sees it as up, treating as a local network blip"
          );
          return; // record nothing: our own path is the unreliable party
        }
        if (confirmation === "confirmed") {
          result = { ...result, error: `${result.error} (confirmed by peer)` };
        }
      }

      recordResult(monitor, result);
    } finally {
      this.inFlight.delete(monitor.id);
    }
  }
}
