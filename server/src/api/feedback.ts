import type { FastifyInstance, FastifyRequest } from "fastify";
import { auth } from "../sync/firebase.js";
import { requireAuth, requireAdmin } from "./auth.js";
import { verifyRecaptcha, botGateApplies } from "../lib/recaptcha.js";
import {
  insertFeedback,
  isDuplicateFeedback,
  listFeedback,
  countFeedbackByStatus,
  updateFeedback,
  deleteFeedback,
} from "../sync/feedbackStore.js";
import type { FeedbackKind, FeedbackStatus } from "../types.js";
import { log } from "../lib/log.js";

/**
 * The contact / suggestion form, and the operator inbox that reads it.
 *
 * The submit route is deliberately open to signed-out visitors. A contact form
 * that requires an account cannot receive the one message that matters most —
 * "I tried to sign up and it did not work" — so the sender is identified when
 * a token is present and asked for an address when it is not.
 *
 * That openness is the whole risk surface, so it is bounded in four ways:
 * reCAPTCHA on the anonymous path, a length cap, a duplicate window, and the
 * global rate limiter. None of them is sufficient alone.
 */

const KINDS: readonly FeedbackKind[] = ["suggestion", "bug", "question", "other"];
const STATUSES: readonly FeedbackStatus[] = ["new", "read", "archived"];

/** Long enough for a real bug report, short enough that a row is not a payload. */
const MAX_MESSAGE = 4000;
const MIN_MESSAGE = 10;
const MAX_NAME = 120;
const MAX_EMAIL = 254; // RFC 5321 maximum path length.

/** A resubmission inside this window is the same message, not a second one. */
const DUPLICATE_WINDOW_MS = 10 * 60 * 1000;

/**
 * Deliberately permissive. This is a reply-to address, not a login: the cost of
 * rejecting a valid unusual address is a lost message, and the cost of
 * accepting an invalid one is a bounce nobody sees. Firebase already validates
 * the addresses that matter.
 */
function looksLikeEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && v.length <= MAX_EMAIL;
}

/**
 * The sender, if they happen to be signed in.
 *
 * Never fails the request. An expired or malformed token on a public form is
 * not an error — it just means we fall back to the address in the body, and
 * the message is recorded as anonymous.
 */
async function identifySender(
  req: FastifyRequest
): Promise<{ uid: string; email: string | null; name: string | null } | null> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  try {
    const decoded = await auth().verifyIdToken(header.slice(7));
    return {
      uid: decoded.uid,
      email: typeof decoded.email === "string" ? decoded.email : null,
      name: typeof decoded.name === "string" ? decoded.name : null,
    };
  } catch {
    return null;
  }
}

export async function feedbackRoutes(app: FastifyInstance): Promise<void> {
  // ------------------------------------------------------------- submitting

  app.post<{
    Body: {
      kind?: string;
      message?: string;
      email?: string;
      name?: string;
      appVersion?: string;
      recaptchaToken?: string;
    };
  }>("/v1/feedback", async (req, reply) => {
    const body = req.body ?? {};

    const message = String(body.message ?? "").trim();
    if (message.length < MIN_MESSAGE) {
      return reply
        .code(400)
        .send({ error: `Tell us a little more — at least ${MIN_MESSAGE} characters.` });
    }
    if (message.length > MAX_MESSAGE) {
      return reply
        .code(400)
        .send({ error: `That is longer than we can accept (${MAX_MESSAGE} characters).` });
    }

    const kind = KINDS.includes(body.kind as FeedbackKind)
      ? (body.kind as FeedbackKind)
      : "other";

    const sender = await identifySender(req);

    // A signed-in sender's address comes from their token, never from the
    // body: otherwise anyone could file a message under someone else's
    // address and an operator would reply to the wrong person.
    const email = (sender?.email ?? String(body.email ?? "").trim()).toLowerCase();
    if (!looksLikeEmail(email)) {
      return reply
        .code(400)
        .send({ error: "We need an email address to reply to." });
    }

    const name = String(body.name ?? sender?.name ?? "").trim().slice(0, MAX_NAME);

    // The bot gate applies only to the anonymous path. A verified Firebase
    // token is already stronger evidence of a person than a reCAPTCHA score,
    // and asking a signed-in user to solve a captcha to report a bug is how
    // you stop hearing about bugs.
    if (!sender && botGateApplies(req.headers["x-client"])) {
      const verdict = await verifyRecaptcha(body.recaptchaToken, "feedback", req.ip);
      if (!verdict.ok) {
        log.warn(
          { score: verdict.score, reason: verdict.reason, ip: req.ip },
          "feedback refused by recaptcha"
        );
        return reply.code(429).send({
          error: "We could not verify this request. Reload the page and try again.",
          code: "recaptcha-failed",
        });
      }
    }

    // Idempotent for the impatient-second-click case. Reported as success:
    // the sender's message did arrive, and telling them it was a duplicate
    // invites them to send it a third time with a word changed.
    if (await isDuplicateFeedback(email, message, DUPLICATE_WINDOW_MS)) {
      log.info({ email }, "feedback: duplicate suppressed");
      return reply.code(202).send({ ok: true, duplicate: true });
    }

    const saved = await insertFeedback({
      kind,
      message,
      email,
      name,
      uid: sender?.uid ?? null,
      orgId: null,
      source: typeof req.headers["x-client"] === "string" ? req.headers["x-client"] : "web",
      appVersion: String(body.appVersion ?? "").slice(0, 40) || null,
    });

    log.info(
      { id: saved.id, kind, authenticated: !!sender },
      "feedback received"
    );
    return reply.code(201).send({ ok: true, id: saved.id });
  });

  // --------------------------------------------------------- operator inbox

  const guard = { preHandler: [requireAuth(), requireAdmin] };

  app.get<{ Querystring: { status?: string; limit?: string } }>(
    "/v1/admin/feedback",
    guard,
    async (req) => {
      const status = STATUSES.includes(req.query.status as FeedbackStatus)
        ? (req.query.status as FeedbackStatus)
        : undefined;
      const limit = Number(req.query.limit) || undefined;
      // In parallel: the counts drive the badges and the list drives the
      // rows, and neither depends on the other.
      const [counts, messages] = await Promise.all([
        countFeedbackByStatus(),
        listFeedback({ status, limit }),
      ]);
      return { counts, messages };
    }
  );

  app.patch<{
    Params: { id: string };
    Body: { status?: string; operatorNote?: string };
  }>("/v1/admin/feedback/:id", guard, async (req, reply) => {
    const patch: { status?: FeedbackStatus; operatorNote?: string } = {};

    if (req.body?.status !== undefined) {
      if (!STATUSES.includes(req.body.status as FeedbackStatus)) {
        return reply.code(400).send({ error: "Unknown status." });
      }
      patch.status = req.body.status as FeedbackStatus;
    }
    if (req.body?.operatorNote !== undefined) {
      patch.operatorNote = String(req.body.operatorNote).slice(0, MAX_MESSAGE);
    }

    if (!(await updateFeedback(req.params.id, patch))) {
      return reply.code(404).send({ error: "No such message." });
    }
    return { ok: true };
  });

  app.delete<{ Params: { id: string } }>(
    "/v1/admin/feedback/:id",
    guard,
    async (req, reply) => {
      if (!(await deleteFeedback(req.params.id))) {
        return reply.code(404).send({ error: "No such message." });
      }
      return { ok: true };
    }
  );
}
