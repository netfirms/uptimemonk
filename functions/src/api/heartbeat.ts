import { onRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { Timestamp } from "firebase-admin/firestore";
import { col } from "../lib/firestore";
import { recordResult } from "../monitors/recordResult";
import { PRIMARY_REGION } from "../config";
import type { Monitor } from "../types";

/**
 * Cron / heartbeat ingest. A customer's backup script ends with:
 *
 *   curl -fsS https://<region>-<project>.cloudfunctions.net/heartbeat/<token>
 *
 * Receiving the ping pushes `nextCheckAt` into the future by the grace period.
 * If the job never runs, the dispatcher reaches the monitor and declares it
 * down — no extra machinery needed, the same state machine handles it.
 */
export const heartbeat = onRequest(
  { region: PRIMARY_REGION, cors: true, memory: "256MiB", maxInstances: 40 },
  async (req, res) => {
    const token = req.path.split("/").filter(Boolean).pop();
    if (!token || token.length < 16) {
      res.status(400).send("Missing or malformed heartbeat token");
      return;
    }

    const snap = await col
      .monitors()
      .where("heartbeatToken", "==", token)
      .limit(1)
      .get();

    if (snap.empty) {
      res.status(404).send("Unknown heartbeat token");
      return;
    }

    const doc = snap.docs[0];
    const monitor = doc.data() as Monitor;
    const now = Date.now();
    const grace = Math.max(60, monitor.heartbeatGraceSeconds ?? monitor.intervalSeconds);

    await doc.ref.update({
      nextCheckAt: Timestamp.fromMillis(now + grace * 1000),
    });

    await recordResult(doc.id, monitor, {
      ok: true,
      responseTimeMs: 0,
      region: PRIMARY_REGION,
      checkedAt: now,
      meta: { source: "heartbeat", ip: req.ip },
    });

    logger.debug("heartbeat received", { monitorId: doc.id });
    res.status(200).send("ok");
  }
);
