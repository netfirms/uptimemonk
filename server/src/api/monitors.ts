import type { FastifyInstance } from "fastify";
import { Timestamp } from "firebase-admin/firestore";
import { col } from "../sync/firebase.js";
import { requireAuth } from "./auth.js";
import { buildMonitor, ValidationError, type MonitorInput } from "../monitors/validate.js";
import { limitsFor } from "../lib/plans.js";
import { getOrgPlan, listMonitors } from "../db/repo.js";
import { log } from "../lib/log.js";
import type { Plan } from "../types.js";

/**
 * Monitor create, edit and delete.
 *
 * Writes land in Firestore, not SQLite: Firestore is the source of truth for
 * configuration, and the worker picks the change up through its listener
 * within a second. Routing a local change through Firestore looks like a
 * detour, but it keeps exactly one sync path — and one path is the reason this
 * hybrid does not drift.
 */
export async function monitorRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", requireAuth());

  const monitorBody = {
    type: "object",
    additionalProperties: false,
    properties: {
      name: { type: "string", maxLength: 120 },
      type: {
        type: "string",
        enum: ["http", "keyword", "tcp", "dns", "ssl", "icmp", "heartbeat"],
      },
      target: { type: "string", maxLength: 2048 },
      port: { type: "integer", minimum: 1, maximum: 65535 },
      method: { type: "string", enum: ["GET", "HEAD", "POST"] },
      requestHeaders: { type: "object", additionalProperties: { type: "string" } },
      requestBody: { type: "string", maxLength: 8192 },
      acceptedStatusCodes: { type: "array", items: { type: "string" }, maxItems: 20 },
      followRedirects: { type: "boolean" },
      keyword: { type: "string", maxLength: 512 },
      keywordInverted: { type: "boolean" },
      dnsRecordType: { type: "string", enum: ["A", "AAAA", "CNAME", "MX", "TXT", "NS"] },
      dnsExpectedValue: { type: "string", maxLength: 512 },
      sslExpiryWarningDays: { type: "integer", minimum: 1, maximum: 365 },
      heartbeatGraceSeconds: { type: "integer", minimum: 60 },
      intervalSeconds: { type: "integer", minimum: 10, maximum: 86400 },
      timeoutSeconds: { type: "integer", minimum: 1, maximum: 30 },
      confirmationThreshold: { type: "integer", minimum: 1, maximum: 10 },
      regions: { type: "array", items: { type: "string" }, maxItems: 3 },
      alertContactIds: { type: "array", items: { type: "string" }, maxItems: 50 },
      maintenanceWindows: { type: "array", maxItems: 20 },
    },
  } as const;

  app.get("/v1/monitors", async (req) => {
    return { monitors: listMonitors(req.user!.orgId) };
  });

  app.post<{ Body: MonitorInput }>(
    "/v1/monitors",
    { schema: { body: monitorBody } },
    async (req, reply) => {
      const { orgId } = req.user!;
      const plan = getOrgPlan(orgId) as Plan;
      const limits = limitsFor(plan);

      // Count against the local mirror: it is authoritative enough for a quota
      // check and avoids a Firestore read on every create.
      const existing = listMonitors(orgId).length;
      if (existing >= limits.maxMonitors) {
        return reply.code(402).send({
          error: `You've reached the ${limits.maxMonitors}-monitor limit on the ${limits.label} plan`,
        });
      }

      const monitor = await buildMonitor(req.body, orgId, plan);
      const now = Timestamp.now();
      const ref = await col.monitors().add({
        ...monitor,
        enabled: true,
        status: "pending",
        inMaintenance: false,
        consecutiveFailures: 0,
        createdAt: now,
        updatedAt: now,
      });

      log.info({ monitorId: ref.id, orgId, type: monitor.type }, "monitor created");
      return reply.code(201).send({ id: ref.id, ...monitor });
    }
  );

  app.patch<{ Params: { id: string }; Body: MonitorInput }>(
    "/v1/monitors/:id",
    { schema: { body: monitorBody } },
    async (req, reply) => {
      const { orgId } = req.user!;
      const snap = await col.monitors().doc(req.params.id).get();
      const current = snap.data();
      if (!snap.exists || current?.orgId !== orgId) {
        return reply.code(404).send({ error: "No such monitor" });
      }

      const plan = getOrgPlan(orgId) as Plan;
      const monitor = await buildMonitor(req.body, orgId, plan, current as never);
      await snap.ref.update({ ...monitor, updatedAt: Timestamp.now() });
      return { id: req.params.id, ...monitor };
    }
  );

  app.post<{ Params: { id: string } }>("/v1/monitors/:id/pause", async (req, reply) => {
    const { orgId } = req.user!;
    const snap = await col.monitors().doc(req.params.id).get();
    if (!snap.exists || snap.data()?.orgId !== orgId) {
      return reply.code(404).send({ error: "No such monitor" });
    }
    const enabled = snap.data()?.enabled === false;
    await snap.ref.update({ enabled, updatedAt: Timestamp.now() });
    return { id: req.params.id, enabled };
  });

  app.delete<{ Params: { id: string } }>("/v1/monitors/:id", async (req, reply) => {
    const { orgId } = req.user!;
    const snap = await col.monitors().doc(req.params.id).get();
    if (!snap.exists || snap.data()?.orgId !== orgId) {
      return reply.code(404).send({ error: "No such monitor" });
    }
    await snap.ref.delete();
    return reply.code(204).send();
  });

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof ValidationError) {
      return reply.code(err.status).send({ error: err.message });
    }
    if ((err as { validation?: unknown }).validation) {
      // Fastify's schema errors read well enough to show a user directly.
      return reply.code(400).send({ error: (err as Error).message });
    }
    log.error({ err }, "monitor route failed");
    return reply.code(500).send({ error: "Something went wrong on our side" });
  });
}
