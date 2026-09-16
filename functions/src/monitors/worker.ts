import { onTaskDispatched } from "firebase-functions/v2/tasks";
import { logger } from "firebase-functions";
import { col } from "../lib/firestore";
import { runProbe } from "../checks";
import { recordResult } from "./recordResult";
import { enqueueCheck, verifyRegionOf } from "../lib/queues";
import type { CheckTask, Monitor, ProbeRegion } from "../types";

/**
 * The probe worker. One deployment per region; `makeWorker` keeps them
 * identical so adding a region is a one-line change in index.ts.
 *
 * Flow: probe → if it failed and a second region is configured and this run is
 * not already a verification, hand it to the other region instead of recording
 * a failure. Only a failure seen from two continents becomes an incident, which
 * kills the single biggest source of false alarms in uptime monitoring.
 */
export function makeWorker(region: ProbeRegion) {
  return onTaskDispatched<CheckTask>(
    {
      region,
      memory: "256MiB",
      timeoutSeconds: 60,
      retryConfig: { maxAttempts: 2, minBackoffSeconds: 5 },
      rateLimits: { maxConcurrentDispatches: 60, maxDispatchesPerSecond: 100 },
    },
    async (req) => {
      const { monitorId, verifying, originalError } = req.data;

      const snap = await col.monitor(monitorId).get();
      if (!snap.exists) {
        logger.info("worker: monitor gone, dropping task", { monitorId });
        return;
      }
      const monitor = snap.data() as Monitor;
      if (!monitor.enabled) return;

      const result = await runProbe(monitor, region);

      // Cross-region confirmation before we declare an outage.
      const verifyRegion = verifyRegionOf(monitor);
      if (!result.ok && !verifying && verifyRegion) {
        logger.debug("worker: failure, asking second region", {
          monitorId,
          from: region,
          verifyIn: verifyRegion,
        });
        await enqueueCheck(monitorId, verifyRegion, {
          verifying: true,
          originalError: result.error,
        });
        return;
      }

      if (!result.ok && verifying && originalError) {
        result.error = `${originalError} (confirmed from ${region})`;
      }

      await recordResult(monitorId, monitor, result);
    }
  );
}
