import { onRequest } from "firebase-functions/v2/https";
import { createHash } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import { col } from "../lib/firestore";
import {
  assertCanAddMonitor,
  buildMonitor,
  limitsForOrg,
  type MonitorInput,
} from "../monitors/crud";
import { PRIMARY_REGION } from "../config";
import type { Monitor } from "../types";

/**
 * Minimal public REST API (the thing every uptime tool gets asked for).
 * Auth: `Authorization: Bearer um_live_...`, hashed and looked up in `apiKeys`.
 *
 *   GET  /v1/monitors            list
 *   GET  /v1/monitors/:id        one monitor + current state
 *   POST /v1/monitors            create
 *   POST /v1/monitors/:id/pause  pause / resume
 */
export const api = onRequest(
  { region: PRIMARY_REGION, cors: true, memory: "256MiB", maxInstances: 20 },
  async (req, res) => {
    const auth = req.get("authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) {
      res.status(401).json({ error: "Missing bearer token" });
      return;
    }

    const hash = createHash("sha256").update(token).digest("hex");
    const keySnap = await col.apiKeys().where("hash", "==", hash).limit(1).get();
    if (keySnap.empty || keySnap.docs[0].data().revoked) {
      res.status(401).json({ error: "Invalid API key" });
      return;
    }
    const orgId = keySnap.docs[0].data().orgId as string;
    const planLimits = await limitsForOrg(orgId);
    if (!planLimits.apiAccess) {
      res.status(402).json({
        error: `API access is not included in the ${planLimits.label} plan`,
      });
      return;
    }
    await keySnap.docs[0].ref.update({ lastUsedAt: Timestamp.now() });

    const parts = req.path.split("/").filter(Boolean); // ["v1","monitors",...]
    const [, resource, id, action] = parts;

    if (resource !== "monitors") {
      res.status(404).json({ error: "Unknown resource" });
      return;
    }

    try {
      if (req.method === "GET" && !id) {
        const snap = await col.monitors().where("orgId", "==", orgId).get();
        res.json({ monitors: snap.docs.map(serialise) });
        return;
      }

      if (req.method === "GET" && id) {
        const doc = await col.monitor(id).get();
        if (!doc.exists || (doc.data() as Monitor).orgId !== orgId) {
          res.status(404).json({ error: "Not found" });
          return;
        }
        res.json({ monitor: serialise(doc) });
        return;
      }

      if (req.method === "POST" && !id) {
        const limits = planLimits;
        await assertCanAddMonitor(orgId, limits);

        // Same validator the dashboard goes through — plan limits, target
        // guard and header sanitising all live in one place.
        const monitor = await buildMonitor(
          (req.body ?? {}) as MonitorInput,
          orgId,
          limits
        );
        const now = Timestamp.now();
        const ref = await col.monitors().add({
          ...monitor,
          enabled: true,
          status: "pending",
          inMaintenance: false,
          consecutiveFailures: 0,
          nextCheckAt: now,
          createdAt: now,
        } as Monitor);
        res.status(201).json({ id: ref.id, ...monitor });
        return;
      }

      if (req.method === "POST" && id && action === "pause") {
        const doc = await col.monitor(id).get();
        if (!doc.exists || (doc.data() as Monitor).orgId !== orgId) {
          res.status(404).json({ error: "Not found" });
          return;
        }
        const enabled = !(doc.data() as Monitor).enabled;
        await doc.ref.update({
          enabled,
          status: enabled ? "pending" : "paused",
          nextCheckAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
        res.json({ id, enabled });
        return;
      }

      res.status(405).json({ error: "Method not allowed" });
    } catch (err) {
      const e = err as { code?: string; message?: string };
      const status =
        e.code === "invalid-argument"
          ? 400
          : e.code === "permission-denied" || e.code === "resource-exhausted"
            ? 402
            : e.code === "not-found"
              ? 404
              : 500;
      res.status(status).json({ error: e.message ?? "Internal error" });
    }
  }
);

function serialise(doc: FirebaseFirestore.DocumentSnapshot) {
  const m = doc.data() as Monitor;
  return {
    id: doc.id,
    name: m.name,
    type: m.type,
    target: m.target,
    status: m.status,
    intervalSeconds: m.intervalSeconds,
    lastCheckedAt: m.lastCheckedAt?.toDate().toISOString() ?? null,
    lastResponseTimeMs: m.lastResponseTimeMs ?? null,
    lastError: m.lastError ?? null,
    uptime24h: m.uptime24h ?? null,
    uptime30d: m.uptime30d ?? null,
  };
}
