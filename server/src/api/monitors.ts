import type { FastifyInstance } from "fastify";
import { Timestamp } from "firebase-admin/firestore";
import { col } from "../sync/firebase.js";
import { requireAuth } from "./auth.js";
import {
  assertFitsBudget,
  buildMonitor,
  ValidationError,
  type MonitorInput,
} from "../monitors/validate.js";
import {
  dayRollupsFor,
  getMonitor,
  getOrgCredit,
  getOrgPlan,
  historySummary,
  incidentsFor,
  listMonitors,
  recentSamples,
} from "../db/repo.js";
import { log } from "../lib/log.js";
import { parseRange } from "../lib/ranges.js";
import { seriesFor, sinceHourFor } from "../monitors/series.js";
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
      keywordCaseSensitive: { type: "boolean" },
      dnsRecordType: { type: "string", enum: ["A", "AAAA", "CNAME", "MX", "TXT", "NS"] },
      dnsExpectedValue: { type: "string", maxLength: 512 },
      sslExpiryWarningDays: { type: "integer", minimum: 1, maximum: 365 },
      heartbeatGraceSeconds: { type: "integer", minimum: 60 },
      intervalSeconds: { type: "integer", minimum: 5, maximum: 86400 },
      timeoutSeconds: { type: "integer", minimum: 1, maximum: 30 },
      confirmationThreshold: { type: "integer", minimum: 1, maximum: 10 },
      regions: { type: "array", items: { type: "string" }, maxItems: 3 },
      alertContactIds: { type: "array", items: { type: "string" }, maxItems: 50 },
      publicOnStatusPage: { type: "boolean" },
      muteAlerts: { type: "boolean" },
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

      const monitor = await buildMonitor(req.body, orgId, plan);

      // Against the local mirror: authoritative enough for a budget check, and
      // it avoids a Firestore read on every create.
      assertFitsBudget(getOrgCredit(orgId), listMonitors(orgId), {
        intervalSeconds: monitor.intervalSeconds!,
        enabled: true,
      });
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

  /**
   * Everything the detail view needs, in one request.
   *
   * Served from the worker's SQLite rather than Firestore: per-check history
   * deliberately never leaves this box, which is what keeps the Firestore
   * write bill independent of monitor count.
   */
  app.get<{
    Params: { id: string };
    Querystring: { hours?: string; days?: string; range?: string };
  }>(
    "/v1/monitors/:id/history",
    async (req, reply) => {
      const { orgId } = req.user!;
      const monitor = getMonitor(req.params.id);

      // Tenancy is checked here and not by a rule — this path does not go
      // through Firestore, so nothing else would check it.
      if (!monitor || monitor.orgId !== orgId) {
        return reply.code(404).send({ error: "No such monitor" });
      }

      const hours = Math.min(168, Math.max(1, Number(req.query.hours) || 24));
      const days = Math.min(90, Math.max(1, Number(req.query.days) || 90));
      const range = parseRange(req.query.range);
      const series = seriesFor(monitor.id, range);

      return {
        monitor: {
          id: monitor.id,
          name: monitor.name,
          type: monitor.type,
          target: monitor.target,
          status: monitor.enabled ? monitor.status : "paused",
          enabled: monitor.enabled,
          intervalSeconds: monitor.intervalSeconds,
          lastCheckedAt: monitor.lastCheckedAt ?? null,
          lastResponseTimeMs: monitor.lastResponseTimeMs ?? null,
          lastError: monitor.lastError ?? null,
          uptime24h: monitor.uptime24h ?? null,
          uptime7d: monitor.uptime7d ?? null,
          uptime30d: monitor.uptime30d ?? null,
          certExpiresAt: monitor.certExpiresAt ?? null,
          heartbeatToken: monitor.heartbeatToken ?? null,
          heartbeatGraceSeconds: monitor.heartbeatGraceSeconds ?? null,
        },
        // The range-aware view: buckets for the bars, points for the chart.
        ...series,
        incidents: incidentsFor(monitor.id, 25),
        // Scoped to the range, so the totals describe what is on screen.
        summary: historySummary(monitor.id, sinceHourFor(range)),
        // Kept alongside the new fields so a bundle loaded before this change
        // keeps rendering until the tab is reloaded.
        days: dayRollupsFor(monitor.id, days).reverse(),
        samples: recentSamples(monitor.id, hours),
        window: { hours, days },
      };
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

      // Editing is the other way to overspend: speeding an existing monitor up
      // costs exactly as much as adding a fast new one.
      assertFitsBudget(
        getOrgCredit(orgId),
        listMonitors(orgId),
        {
          intervalSeconds: monitor.intervalSeconds!,
          enabled: current?.enabled !== false,
        },
        req.params.id
      );
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
    // Remove the mirrored incidents too. The dashboard lists incidents by org,
    // so leaving them behind means it keeps showing incidents belonging to a
    // monitor the user just deleted.
    const incidents = await col.incidents().where("monitorId", "==", req.params.id).get();
    if (!incidents.empty) {
      const batch = col.incidents().firestore.batch();
      incidents.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }

    await snap.ref.delete();
    log.info(
      { monitorId: req.params.id, incidentsRemoved: incidents.size },
      "monitor deleted"
    );
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
    // Malformed request framing is the caller's problem, not a server fault.
    // Reporting it as a 500 sent people hunting for a backend outage when the
    // request simply declared a body it did not send.
    const code = (err as { code?: string }).code ?? "";
    if (code.startsWith("FST_ERR_CTP_")) {
      return reply.code(400).send({ error: (err as Error).message });
    }
    log.error({ err }, "monitor route failed");
    return reply.code(500).send({ error: "Something went wrong on our side" });
  });
}
