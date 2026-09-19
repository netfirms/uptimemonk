import type { FastifyInstance } from "fastify";
import { readFileSync } from "node:fs";
import { Timestamp } from "firebase-admin/firestore";
import { auth, col } from "../sync/firebase.js";
import { getMonitorByHeartbeatToken, getMonitor, getOrgPlan, setDueAt } from "../db/repo.js";
import { limitsFor } from "../lib/plans.js";
import { flush, recordResult } from "../monitors/recordResult.js";
import { handleVerifyRequest, signatureMatches } from "../probe/verify.js";
import { requireAuth, needsEmailConfirmation } from "./auth.js";
import { log } from "../lib/log.js";
import { verifyRecaptcha, botGateApplies } from "../lib/recaptcha.js";
import { SECRET_CONFIG_KEYS } from "../config.js";
import { requireAdmin } from "./auth.js";
import { readinessSummary } from "../lib/readiness.js";
import { API_VERSION, REGION, VERIFY_SECRET, getConfigMetadata } from "../config.js";
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
    const handleHeartbeat = async (req: any, reply: any) => {
      const { token } = req.params;
      if (!token || token.length < 16) {
        return reply.code(400).send("Malformed heartbeat token");
      }

      const monitor = getMonitorByHeartbeatToken(token);
      if (!monitor) return reply.code(404).send("Unknown heartbeat token");

      const query = (req.query || {}) as Record<string, string | undefined>;
      const body = (req.body || {}) as Record<string, unknown>;

      const isFailure =
        query.status === "fail" ||
        query.status === "error" ||
        body.status === "fail" ||
        body.status === "error";

      const errorMsg =
        (body.error as string) ||
        query.error ||
        (isFailure ? "Heartbeat reported execution failure" : undefined);

      const durationMs = Number(body.durationMs ?? query.durationMs) || 0;
      const now = Date.now();

      if (isFailure) {
        recordResult(monitor, {
          ok: false,
          responseTimeMs: durationMs,
          error: errorMsg,
          region: REGION,
          checkedAt: now,
          meta: { source: "heartbeat", explicitFailure: true, durationMs },
        });
        flush();
        return reply.code(200).send({ status: "failure-recorded", monitorId: monitor.id });
      }

      const grace = Math.max(60, monitor.heartbeatGraceSeconds ?? monitor.intervalSeconds ?? 300);
      setDueAt(monitor.id, now + grace * 1000);

      recordResult(monitor, {
        ok: true,
        responseTimeMs: durationMs,
        region: REGION,
        checkedAt: now,
        meta: { source: "heartbeat", durationMs },
      });

      // Flush synchronously so recovery lands immediately.
      flush();

      return reply.code(200).send("ok");
    };

    app.get<{ Params: { token: string } }>("/heartbeat/:token", handleHeartbeat);
    app.post<{ Params: { token: string } }>("/heartbeat/:token", handleHeartbeat);

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
  app.post<{ Body?: { recaptchaToken?: string } }>("/v1/bootstrap", async (req, reply) => {
    const header = req.headers.authorization ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) return reply.code(401).send({ error: "Sign in to continue" });

    let decoded;
    try {
      decoded = await auth().verifyIdToken(token);
    } catch {
      return reply.code(401).send({ error: "Your session has expired. Sign in again." });
    }

    /**
     * No workspace until the address is confirmed.
     *
     * Bootstrap has its own token check rather than `requireAuth` — it is the
     * one route that runs *before* a workspace exists — so the rule has to be
     * repeated here or it would be the single way in around it.
     *
     * Ordering matters: this comes before the early return, so someone who
     * somehow bootstrapped while unverified still cannot proceed.
     */
    if (needsEmailConfirmation(decoded)) {
      return reply.code(403).send({
        error: "Confirm your email address to continue.",
        code: "email-not-verified",
      });
    }

    if (decoded.orgId) {
      return { orgId: decoded.orgId, created: false };
    }

    /**
     * The one place a bot can be stopped — for browsers.
     *
     * Sign-up happens in the browser against Google directly, so this server
     * never sees it and cannot gate it. Creating a *workspace* does come
     * through here, and that is the request with the cost — a Firestore
     * document, a scheduler slot, a free capacity allowance. An account that
     * cannot create one has achieved nothing.
     *
     * Checked after the early return above, so an existing customer whose
     * token already carries an orgId never needs a token for it.
     *
     * THE MOBILE EXEMPTION IS A DELIBERATE HOLE, NOT AN OVERSIGHT.
     *
     * reCAPTCHA v3 is a browser technology; the Flutter app cannot mint a
     * token, so before this exemption every mobile sign-up failed here with a
     * 429. `X-Client` is an ordinary request header and anyone can send it
     * from curl, so this does not merely exempt the app — it exempts anyone
     * who reads this file, or who watches the app's traffic once. Treat the
     * bot gate as advisory rather than as a control.
     *
     * The real fix is Firebase App Check (Play Integrity on Android,
     * DeviceCheck/App Attest on iOS), which attests the app binary and device
     * and is verifiable server-side the way a reCAPTCHA token is. It needs
     * console setup per platform, which is why it is not here yet. When it
     * lands, verify the App Check token for mobile and delete this exemption
     * rather than keeping both.
     */
    if (botGateApplies(req.headers["x-client"])) {
      const verdict = await verifyRecaptcha(
        req.body?.recaptchaToken,
        "signup",
        req.ip
      );
      if (!verdict.ok) {
        log.warn(
          { uid: decoded.uid, score: verdict.score, reason: verdict.reason },
          "bootstrap refused by recaptcha"
        );
        return reply.code(429).send({
          error: "We could not verify this request. Reload the page and try again.",
          code: "recaptcha-failed",
        });
      }
    } else {
      // Logged so the exemption is visible in production rather than silent:
      // a spike here is someone scripting it, not customers buying phones.
      log.info({ uid: decoded.uid, ip: req.ip }, "bootstrap: bot gate skipped for mobile client");
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
      /**
       * Trust the token, not the sign-up.
       *
       * A Google sign-in proves the address: Google checked it, and
       * `email_verified` says so. An email/password sign-up proves nothing —
       * anyone can type a stranger's address and choose a password — and
       * marking it verified would have this service mailing downtime alerts
       * to someone who never asked for them. That is precisely the open-relay
       * abuse `contacts.ts` exists to prevent, so the same rule applies here.
       *
       * An unverified contact is still created: it appears in the Alerts
       * panel with a "Resend confirmation" button, and nothing is delivered
       * to it until the address is confirmed.
       */
      batch.set(col.alertContacts().doc(), {
        orgId: orgRef.id,
        channel: "email",
        name: decoded.email,
        destination: decoded.email,
        enabled: true,
        verified: decoded.email_verified === true,
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

  /** Update user profile (username / displayName). */
  app.patch<{ Body: { displayName?: string } }>(
    "/v1/me",
    { preHandler: requireAuth() },
    async (req, reply) => {
      const raw = req.body?.displayName;
      if (typeof raw !== "string" || !raw.trim()) {
        return reply.code(400).send({ error: "Username cannot be empty" });
      }
      const trimmed = raw.trim();
      if (trimmed.length < 2) {
        return reply.code(400).send({ error: "Username must be at least 2 characters" });
      }
      if (trimmed.length > 50) {
        return reply.code(400).send({ error: "Username cannot exceed 50 characters" });
      }

      const uid = req.user!.uid;
      try {
        await auth().updateUser(uid, { displayName: trimmed });
      } catch (err) {
        log.warn({ uid, err }, "failed to update auth user displayName");
      }
      await col.users().doc(uid).set({ displayName: trimmed }, { merge: true });
      log.info({ uid, displayName: trimmed }, "user updated displayName");

      return { uid, displayName: trimmed };
    }
  );

  /**
   * Admin configuration metadata.
   *
   * Returns every AppConfig field with its effective value, source (env or
   * Firestore), and the env-fallback value — so the admin console can show
   * what the worker is actually running with, not client-side guesses.
   *
   * Secret fields are masked: the admin sees whether a secret is set and
   * from which source, but never the raw value over HTTP. Editing is done
   * via Firestore writes from the admin console, not through this endpoint.
   */
  /**
   * Derived, never hand-listed.
   *
   * This was a literal set and `recaptchaSecret` was not in it, so that key
   * was served in full from an endpoint with no authentication. A list you
   * have to remember to update is a leak waiting for the next credential.
   */
  const SECRET_KEYS = new Set<string>(SECRET_CONFIG_KEYS);

  function maskSecret(val: unknown): string {
    const s = String(val ?? "");
    if (!s) return "";
    if (s.length <= 8) return "•".repeat(s.length);
    return s.slice(0, 4) + "•".repeat(Math.min(s.length - 8, 20)) + s.slice(-4);
  }

  /**
   * Was unauthenticated, on the public internet, returning masked secrets —
   * and one unmasked. Even a mask leaks: first four and last four narrows a
   * key and confirms which are set.
   */
  app.get(
    "/v1/admin/config",
    { preHandler: [requireAuth(), requireAdmin] },
    async (_req, reply) => {
    const meta = getConfigMetadata();
    const result = meta.map((entry) => {
      const isSecret = SECRET_KEYS.has(entry.key);
      return {
        key: entry.key,
        value: isSecret ? maskSecret(entry.value) : entry.value,
        source: entry.source,
        fallbackValue: isSecret ? maskSecret(entry.fallbackValue) : entry.fallbackValue,
      };
    });
    return reply.send(result);
  });
}
