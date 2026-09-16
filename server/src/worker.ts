import { openDb, closeDb } from "./db/index.js";
import { Scheduler } from "./scheduler/scheduler.js";
import {
  reconcileNow,
  startConfigListener,
  startReconcileLoop,
  stopConfigListener,
} from "./sync/configListener.js";
import { startMirror, stopMirror } from "./sync/mirror.js";
import { startFlushLoop, stopFlushLoop } from "./monitors/recordResult.js";
import { startDrainer, stopDrainer } from "./alerts/drainer.js";
import { startRollupLoop } from "./scheduler/rollup.js";
import { log } from "./lib/log.js";
import { HEARTBEAT_URL, REGION, WORKER_VERSION } from "./config.js";
import { writeFileSync } from "node:fs";

/**
 * The worker: scheduler, probe pool, alert drainer, and both sync directions.
 *
 * Runs as its own systemd unit, separate from the API, so that deploying a
 * dashboard change never pauses monitoring — and so a probe storm cannot make
 * the dashboard crawl.
 */

const scheduler = new Scheduler();

/** Where the API process reads worker liveness from — see api/health.ts. */
const STATUS_FILE = process.env.UPTIMEMONK_STATUS_FILE ?? "/var/lib/uptimemonk/worker.json";

function publishStatus(): void {
  try {
    writeFileSync(
      STATUS_FILE,
      JSON.stringify({
        version: WORKER_VERSION,
        region: REGION,
        updatedAt: Date.now(),
        scheduled: scheduler.scheduled,
        queueDepth: scheduler.queueDepth,
        lagMs: scheduler.lagMs(),
      })
    );
  } catch (err) {
    log.warn({ err }, "could not write status file");
  }
}

/**
 * The dead-man's switch. If this worker dies, the organisations it owns stop
 * being checked, silently — the
 * worst failure this product has — so an external service watches for these
 * pings and alerts when they stop. It must be a different provider: a monitor
 * that monitors itself proves nothing when the worker is off.
 *
 * Every worker in the fleet needs its own switch: losing one worker is a
 * partial outage that the others cannot see.
 */
async function pingDeadMansSwitch(): Promise<void> {
  if (!HEARTBEAT_URL) return;
  try {
    await fetch(HEARTBEAT_URL, { signal: AbortSignal.timeout(10_000) });
  } catch (err) {
    log.warn({ err }, "dead-man's switch ping failed");
  }
}

async function main(): Promise<void> {
  openDb();
  log.info({ region: REGION, version: WORKER_VERSION }, "worker starting");

  startFlushLoop();
  startMirror();
  startDrainer();
  startRollupLoop();

  // Reconcile once, synchronously, before anything schedules.
  //
  // The listener alone is not enough: it delivers monitors, but organisations
  // (and therefore plan limits) only arrive through a reconcile. Without this
  // first pass every org looked like "free" until the 15-minute timer fired,
  // so a paying customer's interval and monitor caps were wrong after every
  // restart.
  try {
    await reconcileNow(() => {});
  } catch (err) {
    log.error({ err }, "initial reconcile failed — starting on cached state");
  }

  startConfigListener((changed, removed) => scheduler.refresh(changed, removed));
  startReconcileLoop((changed, removed) => scheduler.refresh(changed, removed));

  scheduler.load();
  scheduler.start();

  const vitals = setInterval(() => {
    publishStatus();
    void pingDeadMansSwitch();
    log.debug(
      {
        scheduled: scheduler.scheduled,
        queueDepth: scheduler.queueDepth,
        lagMs: scheduler.lagMs(),
      },
      "vitals"
    );
  }, 60_000);
  vitals.unref();

  publishStatus();
}

/**
 * Shut down in dependency order: stop taking new work, let in-flight probes
 * finish, write what is buffered, then push a final mirror so the dashboard is
 * not left showing state from before the restart.
 */
async function shutdown(signal: string): Promise<void> {
  log.info({ signal }, "worker shutting down");
  try {
    await scheduler.stop();
    stopConfigListener();
    stopDrainer();
    stopFlushLoop(); // flushes buffered results
    await stopMirror();
    closeDb();
  } catch (err) {
    log.error({ err }, "unclean shutdown");
  } finally {
    process.exit(0);
  }
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("unhandledRejection", (err) => log.error({ err }, "unhandled rejection"));

main().catch((err) => {
  log.fatal({ err }, "worker failed to start");
  process.exit(1);
});
