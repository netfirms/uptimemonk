import type { FastifyInstance } from "fastify";
import { readFileSync } from "node:fs";
import { Timestamp } from "firebase-admin/firestore";
import { auth, col } from "../sync/firebase.js";
import { getMonitorByHeartbeatToken, getMonitor, getOrgPlan, setDueAt } from "../db/repo.js";
import { limitsFor } from "../lib/plans.js";
import { flush, recordResult } from "../monitors/recordResult.js";
import { handleVerifyRequest, signatureMatches } from "../probe/verify.js";
import { requireAuth } from "./auth.js";
import { log } from "../lib/log.js";
import { readinessSummary } from "../lib/readiness.js";
import { API_VERSION, REGION, VERIFY_SECRET } from "../config.js";
import type { Plan } from "../types.js";

const STATUS_FILE = process.env.UPTIMEMONK_STATUS_FILE ?? "/var/lib/uptimemonk/worker.json";

/** Age beyond which the worker is considered wedged rather than merely quiet. */
const WORKER_STALE_MS = 3 * 60_000;
/** Scheduler lag above this means checks are not going out on time. */
const LAG_BUDGET_MS = 60_000;

export async function miscRoutes(app: FastifyInstance): Promise<void> {
  /**
   * Health. Reports scheduler lag, not just process liveness — a wedged
   * scheduler inside a perfectly healthy process is the failure that actually
   * happens, and a liveness probe cannot see it.
   */
  app.get("/healthz", async (_req, reply) => {
    let worker: {
      version?: string;
      updatedAt: number;
      lagMs: number;
      queueDepth: number;
      scheduled: number;
    } | null = null;
    try {
      worker = JSON.parse(readFileSync(STATUS_FILE, "utf8"));
    } catch {
      worker = null;
    }

    const now = Date.now();
    const stale = !worker || now - worker.updatedAt > WORKER_STALE_MS;
    const lagging = !!worker && worker.lagMs > LAG_BUDGET_MS;
    const healthy = !stale && !lagging;

    // Config gaps do not make the service unhealthy — checks are still
    // running — but they must be visible somewhere an operator looks, or a
    // worker that cannot alert anyone reports a cheerful 200 forever.
    const readiness = readinessSummary();

    return reply.code(healthy ? 200 : 503).send({
      readiness,
      status: healthy ? "ok" : stale ? "worker-stale" : "scheduler-lagging",
      version: API_VERSION,
      region: REGION,
      worker: worker
        ? { ...worker, ageMs: now - worker.updatedAt }
        : { error: "no status published" },
    });
  });

  /**
   * Version information for API and worker.
   */
  const getVersionInfo = async () => {
    let worker: { version?: string; updatedAt?: number } | null = null;
    try {
      worker = JSON.parse(readFileSync(STATUS_FILE, "utf8"));
    } catch {
      worker = null;
    }

    return {
      api: API_VERSION,
      worker: worker?.version ?? "unknown",
      region: REGION,
    };
  };

  app.get("/version", getVersionInfo);
  app.get("/v1/version", getVersionInfo);

  /**
   * Heartbeat ingest — the "push" monitor. A customer's cron job ends with a
   * curl to this URL; receiving it pushes the due time forward by the grace
   * period, so the scheduler only ever sees it as due when the job did not run.
   */
  app.get<{ Params: { token: string } }>("/heartbeat/:token", async (req, reply) => {
    const { token } = req.params;
    if (!token || token.length < 16) {
      return reply.code(400).send("Malformed heartbeat token");
    }

    const monitor = getMonitorByHeartbeatToken(token);
    if (!monitor) return reply.code(404).send("Unknown heartbeat token");

    const now = Date.now();
    const grace = Math.max(60, monitor.heartbeatGraceSeconds ?? monitor.intervalSeconds ?? 300);
    setDueAt(monitor.id, now + grace * 1000);

    recordResult(monitor, {
      ok: true,
      responseTimeMs: 0,
      region: REGION,
      checkedAt: now,
      meta: { source: "heartbeat" },
    });

    // Flush synchronously. The buffered write-behind belongs to the worker,
    // which owns the flush timer; in the API process a buffered result would
    // sit in memory until 500 accumulated. That meant a heartbeat monitor that
    // had gone down never recorded its recovery — due_at kept being pushed
    // forward, so it was never re-checked either, and it stayed red forever.
    flush();

    return reply.code(200).send("ok");
  });

  /**
   * Cross-region confirmation. The peer box asks us for a second opinion
   * before an incident is opened.
   *
   * Signed, because this endpoint makes us probe an arbitrary host on the
   * caller's behalf: unsigned, it is a free SSRF proxy with our IP as source.
   */
  app.post<{ Body: { monitorId?: string } }>("/internal/verify", async (req, reply) => {
    if (!VERIFY_SECRET) return reply.code(404).send({ error: "Not found" });

    const raw = JSON.stringify(req.body ?? {});
    const provided = String(req.headers["x-uptimemonk-signature"] ?? "");
    if (!signatureMatches(raw, VERIFY_SECRET, provided)) {
      log.warn({ ip: req.ip }, "rejected unsigned verify request");
      return reply.code(401).send({ error: "Bad signature" });
    }

    const monitor = req.body?.monitorId ? getMonitor(req.body.monitorId) : null;
    if (!monitor) return reply.code(404).send({ error: "Unknown monitor" });

    const ok = await handleVerifyRequest(monitor);
    return { ok, region: REGION };
  });

  /**
   * Workspace bootstrap.
   *
   * On Blaze this would be a `beforeUserCreated` blocking function. The free
   * tier has no such hook, so the client calls this once after signup — and
   * it must be idempotent, because a retry after a dropped response is the
   * normal case, not the exception.
   */
  app.post("/v1/bootstrap", async (req, reply) => {
    const header = req.headers.authorization ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) return reply.code(401).send({ error: "Sign in to continue" });

    let decoded;
    try {
      decoded = await auth().verifyIdToken(token);
    } catch {
      return reply.code(401).send({ error: "Your session has expired. Sign in again." });
    }

    if (decoded.orgId) {
      return { orgId: decoded.orgId, created: false };
    }

    // A claim can lag a moment behind the document; check Firestore too so a
    // second call does not create a duplicate workspace.
    const existing = await col.users().doc(decoded.uid).get();
    const existingOrgId = existing.data()?.orgId as string | undefined;
    if (existingOrgId) {
      await auth().setCustomUserClaims(decoded.uid, {
        ...(decoded as Record<string, unknown>).customClaims as object,
        orgId: existingOrgId,
        role: existing.data()?.role ?? "owner",
      });
      return { orgId: existingOrgId, created: false };
    }

    const orgRef = col.orgs().doc();
    const now = Timestamp.now();
    const batch = col.orgs().firestore.batch();
    batch.set(orgRef, {
      name: decoded.email?.split("@")[0] ?? "My workspace",
      ownerUid: decoded.uid,
      plan: "free",
      createdAt: now,
    });
    batch.set(col.users().doc(decoded.uid), {
      email: decoded.email ?? null,
      orgId: orgRef.id,
      role: "owner",
      createdAt: now,
    });
    if (decoded.email) {
      // The signup address is verified by definition — they just proved it.
      batch.set(col.alertContacts().doc(), {
        orgId: orgRef.id,
        channel: "email",
        name: decoded.email,
        destination: decoded.email,
        enabled: true,
        verified: true,
        createdAt: now,
      });
    }
    await batch.commit();

    await auth().setCustomUserClaims(decoded.uid, { orgId: orgRef.id, role: "owner" });
    log.info({ uid: decoded.uid, orgId: orgRef.id }, "workspace bootstrapped");

    return reply.code(201).send({ orgId: orgRef.id, created: true });
  });

  /** Whoami — lets the dashboard confirm claims propagated after bootstrap. */
  /**
   * Whoami, plus the plan limits the UI needs.
   *
   * Without these the form offered a 1-minute interval to a free account, the
   * server clamped it to the plan floor, and the value silently came back
   * different from what the user picked — which reads as "saving is broken".
   */
  app.get("/v1/me", { preHandler: requireAuth() }, async (req) => {
    const plan = getOrgPlan(req.user!.orgId) as Plan;
    const limits = limitsFor(plan);
    return {
      uid: req.user!.uid,
      orgId: req.user!.orgId,
      role: req.user!.role,
      plan,
      limits: {
        label: limits.label,
        minIntervalSeconds: limits.minIntervalSeconds,
        maxMonitors: limits.maxMonitors,
      },
    };
  });
}
