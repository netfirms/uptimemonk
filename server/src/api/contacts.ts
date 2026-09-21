import type { FastifyInstance } from "fastify";
import { createHash, randomBytes } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import { col } from "../sync/firebase.js";
import { requireAuth } from "./auth.js";
import { assertSafeUrl, BlockedTargetError } from "../lib/targetGuard.js";
import { validateContact, InvalidContactError } from "../alerts/validateContact.js";
import { deliver, sendFcm, type AlertPayload } from "../alerts/channels.js";
import { log } from "../lib/log.js";
import {
  ALERT_FROM_EMAIL,
  API_URL,
  APP_URL,
  MAILGUN_API_KEY,
  MAILGUN_BASE_URL,
  MAILGUN_DOMAIN,
  RESEND_API_KEY,
  TELEGRAM_BOT_TOKEN,
  USER_AGENT,
} from "../config.js";

/** Whichever email provider is configured, if any. */
const EMAIL_READY = Boolean(MAILGUN_API_KEY || RESEND_API_KEY);

/**
 * Alert-contact verification.
 *
 * `sendAlerts` refuses to deliver to an unverified contact, and nothing set
 * that flag except the signup bootstrap — so every contact a customer added
 * themselves was silently dropped. Monitoring that never pages anyone is worse
 * than none, because you believe you are covered.
 *
 * Verification also closes an abuse route: without it anyone could point alerts
 * at an address or webhook they do not own and use this service to send mail to
 * strangers.
 */

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
/** A ceiling, so one org cannot turn this into a bulk mailer. */
const MAX_CONTACTS = 20;
/** Same idea for the test button — it sends real mail to a real inbox. */
const TEST_COOLDOWN_MS = 30_000;
const lastTestAt = new Map<string, number>();

/**
 * A synthetic incident, worded so nobody mistakes it for a real outage.
 *
 * It goes through `deliver()` — the same function the drainer calls, with the
 * same secrets and the same per-channel formatting — because a test that took
 * its own shortcut could pass while real alerts fail, which is worse than no
 * test at all.
 */
function testPayload(): AlertPayload {
  const now = Date.now();
  return {
    event: "down",
    monitorId: "test",
    incidentId: "test",
    monitor: {
      id: "test",
      name: "UptimeMonke test notification",
      target: APP_URL,
    },
    incident: {
      id: "test",
      startedAt: now,
      cause: "This is a test. No monitor is down — you are checking that alerts reach you.",
    },
  } as unknown as AlertPayload;
}
/** Stops the endpoint being used to send someone repeated mail. */
const RESEND_COOLDOWN_MS = 60_000;

const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

/**
 * The document id for one device's push registration.
 *
 * Deterministic on purpose. The old handler queried for an existing token and
 * then inserted if it found none, which is not atomic: the client calls
 * syncDeviceToken() twice on startup (once from the authStateChanges listener,
 * once directly), so two requests raced, both found nothing, and both created
 * a row for the same token. The timestamps proved it — duplicates landed 3ms
 * apart.
 *
 * With the id derived from the identity of the row, a second write is an
 * upsert onto the same document rather than a second document. `set()` is
 * idempotent, so concurrent writers converge instead of multiplying.
 *
 * The token is hashed rather than used raw: document ids may not contain "/",
 * FCM tokens are long and opaque, and this keeps a device token out of the
 * document path where it would show up in any Firestore console URL.
 */
export function deviceDocId(orgId: string, token: string): string {
  return `fcm_${createHash("sha256").update(`${orgId}:${token}`).digest("hex").slice(0, 40)}`;
}

/**
 * Collapse push registrations down to one row per token.
 *
 * Used to clean up the rows the race already produced, and to retire rows for
 * tokens a device has rotated away from. Newest wins — it is the one the
 * device most recently said it wanted alerts on.
 *
 * Pure so it can be tested without Firestore.
 */
export function pickDuplicateFcmRows(
  rows: { id: string; token: string; createdAt: number | null }[]
): string[] {
  const newest = new Map<string, { id: string; at: number }>();
  for (const r of rows) {
    const at = r.createdAt ?? 0;
    const prev = newest.get(r.token);
    if (!prev || at > prev.at) newest.set(r.token, { id: r.id, at });
  }
  const keep = new Set([...newest.values()].map((v) => v.id));
  return rows.filter((r) => !keep.has(r.id)).map((r) => r.id);
}

/**
 * Earlier registrations of the *same device* — same uid, same platform — that
 * a fresh registration supersedes.
 *
 * A token rotates on reinstall or an FCM refresh and the app reports the new
 * one, but nothing removed the old row: the device accumulated identically
 * named entries in Settings, each still able to page it.
 *
 * Scoped to platform on purpose. One account signed in on both an iPhone and
 * an Android has a legitimate token per platform, and matching on uid alone
 * would delete the other device's registration the moment either one launched
 * — silencing a device the user still expects to be paged. Rotation replaces a
 * token for a platform, never across platforms.
 *
 * Pure so the cross-platform case can be tested without Firestore.
 */
export function pickSupersededFcmRows(
  rows: { id: string; token: string; uid: string | null; platform: string | null; channel: string }[],
  current: { id: string; token: string; uid: string; platform: string }
): string[] {
  return rows
    .filter(
      (r) =>
        r.channel === "fcm" &&
        r.uid === current.uid &&
        r.platform === current.platform &&
        r.id !== current.id &&
        r.token !== current.token
    )
    .map((r) => r.id);
}

function message(destination: string, channel: string, link: string): string {
  return [
    `Confirm this ${channel} contact for UptimeMonke.`,
    ``,
    `Someone added "${destination}" to receive downtime alerts.`,
    `If that was you, confirm it here:`,
    ``,
    link,
    ``,
    `The link expires in 24 hours. If this wasn't you, ignore this message —`,
    `nothing will be sent to this destination until it is confirmed.`,
  ].join("\n");
}

async function postJson(url: string, body: unknown, headers: Record<string, string> = {}) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": USER_AGENT, ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    throw new Error(`${url} responded ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
}

/** Send the confirmation over the channel being verified — the only proof
 *  that the destination is reachable and wanted. */
async function deliverVerification(
  contact: { channel: string; destination: string; telegramChatId?: string },
  link: string
): Promise<void> {
  const text = message(contact.destination, contact.channel, link);

  switch (contact.channel) {
    case "email": {
      if (!EMAIL_READY) throw new Error("Email is not configured on this server yet");
      const subject = "Confirm your UptimeMonke alert contact";

      if (MAILGUN_API_KEY) {
        // Form-encoded; Mailgun's v3 messages API rejects a JSON body with a
        // 400 that reads like an auth failure.
        const res = await fetch(
          `${MAILGUN_BASE_URL.replace(/\/$/, "")}/v3/${encodeURIComponent(
            MAILGUN_DOMAIN
          )}/messages`,
          {
            method: "POST",
            headers: {
              authorization: `Basic ${Buffer.from(`api:${MAILGUN_API_KEY}`).toString(
                "base64"
              )}`,
              "content-type": "application/x-www-form-urlencoded",
              "user-agent": USER_AGENT,
            },
            body: new URLSearchParams({
              from: ALERT_FROM_EMAIL,
              to: contact.destination,
              subject,
              text,
            }),
            signal: AbortSignal.timeout(15_000),
          }
        );
        if (!res.ok) {
          // The key must never reach this message — it is returned to the
          // client and written to the log.
          throw new Error(`Mailgun responded ${res.status}: ${(await res.text()).slice(0, 200)}`);
        }
        return;
      }

      await postJson(
        "https://api.resend.com/emails",
        { from: ALERT_FROM_EMAIL, to: contact.destination, subject, text },
        { authorization: `Bearer ${RESEND_API_KEY}` }
      );
      return;
    }

    case "slack":
      // Customer-supplied URLs get the same guard as a probe target: this is
      // an outbound request from inside our network.
      await assertSafeUrl(contact.destination);
      await postJson(contact.destination, { text });
      return;

    case "discord":
      await assertSafeUrl(contact.destination);
      await postJson(contact.destination, { username: "UptimeMonke", content: text });
      return;

    case "webhook":
      await assertSafeUrl(contact.destination);
      await postJson(contact.destination, {
        event: "contact.verification",
        destination: contact.destination,
        confirmUrl: link,
        sentAt: new Date().toISOString(),
      });
      return;

    case "telegram":
      if (!TELEGRAM_BOT_TOKEN) throw new Error("Telegram is not configured on this server yet");
      await postJson(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        chat_id: contact.telegramChatId ?? contact.destination,
        text,
        disable_web_page_preview: true,
      });
      return;

    case "fcm":
      await sendFcm(contact.destination, testPayload());
      return;

    default:
      throw new Error(`Unknown channel: ${contact.channel}`);
  }
}

function page(heading: string, detail: string): string {
  return (
    `<!doctype html><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<title>${heading}</title>` +
    `<div style="font:16px/1.5 system-ui,sans-serif;max-width:32rem;margin:15vh auto;` +
    `padding:0 1.5rem;background:#0b131e;color:#fff">` +
    `<h1 style="font-size:1.4rem;margin:0 0 .5rem">${heading}</h1>` +
    `<p style="color:#94a3b8;margin:0 0 1.5rem">${detail}</p>` +
    `<a href="${APP_URL}" style="color:#3BD671">Back to UptimeMonke</a></div>`
  );
}

export async function contactRoutes(app: FastifyInstance): Promise<void> {
  /**
   * List the org's contacts.
   *
   * Read straight from Firestore rather than the local SQLite mirror: this is
   * configuration, Firestore owns it, and reading the mirror would show a
   * stale list for the second between a write and the listener catching up.
   */
  app.get("/v1/contacts", { preHandler: requireAuth() }, async (req) => {
    const snap = await col.alertContacts().where("orgId", "==", req.user!.orgId).get();
    return {
      /**
       * Which channels this server can actually deliver on.
       *
       * Email and Telegram need a server-side credential the customer cannot
       * supply. Without it every alert on that channel burns its six retries
       * and dies in a log nobody reads — so the UI is told up front rather
       * than letting someone add a contact that can never fire.
       */
      channels: {
        email: EMAIL_READY ? "ready" : "unconfigured",
        telegram: TELEGRAM_BOT_TOKEN ? "ready" : "unconfigured",
        slack: "ready",
        discord: "ready",
        webhook: "ready",
        fcm: "ready",
      },
      contacts: snap.docs
        .map((d) => {
          const c = d.data();
          return {
            id: d.id,
            channel: c.channel,
            name: c.name,
            destination: c.destination,
            telegramChatId: c.telegramChatId ?? null,
            platform: c.platform ?? null,
            enabled: c.enabled !== false,
            verified: c.verified === true,
            // Lets the UI show "confirmation sent" without exposing the token.
            verificationSentAt: c.verificationSentAt?.toMillis?.() ?? null,
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name)),
    };
  });

  /** Add a contact. Always unverified — nothing is delivered until confirmed. */
  app.post<{ Body: Record<string, unknown> }>(
    "/v1/contacts",
    { preHandler: requireAuth() },
    async (req, reply) => {
      const { orgId } = req.user!;

      const existing = await col.alertContacts().where("orgId", "==", orgId).get();
      if (existing.size >= MAX_CONTACTS) {
        return reply
          .code(409)
          .send({ error: `An organisation can have at most ${MAX_CONTACTS} alert contacts` });
      }

      let valid;
      try {
        valid = await validateContact(req.body ?? {});
      } catch (err) {
        if (err instanceof InvalidContactError || err instanceof BlockedTargetError) {
          return reply.code(400).send({ error: err.message });
        }
        throw err;
      }

      if (existing.docs.some((d) => d.data().destination === valid.destination)) {
        return reply.code(409).send({ error: "That destination is already on the list" });
      }

      const ref = col.alertContacts().doc();
      await ref.set({
        orgId,
        ...valid,
        telegramChatId: valid.telegramChatId ?? null,
        // Verification is backend-only and starts false. A client that could
        // set this could page a stranger.
        verified: false,
        createdAt: Timestamp.now(),
      });

      log.info({ contactId: ref.id, channel: valid.channel }, "contact created");
      return reply.code(201).send({ id: ref.id, ...valid, verified: false });
    }
  );

  /** Rename or enable/disable. Channel and destination are immutable — changing
   *  either would silently carry the old destination's verified status. */
  app.patch<{ Params: { id: string }; Body: { name?: string; enabled?: boolean } }>(
    "/v1/contacts/:id",
    { preHandler: requireAuth() },
    async (req, reply) => {
      const ref = col.alertContacts().doc(req.params.id);
      const snap = await ref.get();
      if (!snap.exists || snap.data()?.orgId !== req.user!.orgId) {
        return reply.code(404).send({ error: "No such alert contact" });
      }

      const patch: Record<string, unknown> = {};
      if (typeof req.body?.name === "string") {
        patch.name = req.body.name.trim().slice(0, 120) || snap.data()!.destination;
      }
      if (typeof req.body?.enabled === "boolean") patch.enabled = req.body.enabled;
      if (!Object.keys(patch).length) {
        return reply.code(400).send({ error: "Nothing to change" });
      }

      await ref.update(patch);
      return { id: req.params.id, ...patch };
    }
  );

  /**
   * Send a real alert to one contact, on demand.
   *
   * Only to a *verified* contact: an unverified one already has the
   * confirmation flow for proving the destination, and allowing arbitrary
   * test sends to unconfirmed addresses would make this an open relay with
   * extra steps.
   *
   * Delivery is awaited rather than queued, so the response carries the
   * provider's actual error. "Sent" followed by silence is the exact failure
   * this button exists to rule out.
   */
  app.post<{ Params: { id: string } }>(
    "/v1/contacts/:id/test",
    { preHandler: requireAuth() },
    async (req, reply) => {
      const ref = col.alertContacts().doc(req.params.id);
      const snap = await ref.get();
      const c = snap.data();

      if (!snap.exists || c?.orgId !== req.user!.orgId) {
        return reply.code(404).send({ error: "No such alert contact" });
      }
      if (c.verified !== true) {
        return reply.code(409).send({
          error: "Confirm this contact first — use Resend confirmation.",
        });
      }
      if (c.enabled === false) {
        return reply.code(409).send({ error: "This contact is paused. Resume it first." });
      }

      const since = Date.now() - (lastTestAt.get(req.params.id) ?? 0);
      if (since < TEST_COOLDOWN_MS) {
        return reply.code(429).send({
          error: `Just sent one. Try again in ${Math.ceil((TEST_COOLDOWN_MS - since) / 1000)}s.`,
        });
      }
      lastTestAt.set(req.params.id, Date.now());

      try {
        await deliver(
          {
            id: snap.id,
            orgId: c.orgId,
            channel: c.channel,
            name: c.name,
            destination: c.destination,
            telegramChatId: c.telegramChatId,
            enabled: true,
            verified: true,
          },
          testPayload(),
          {
            mailgunKey: MAILGUN_API_KEY,
            mailgunDomain: MAILGUN_DOMAIN,
            mailgunBaseUrl: MAILGUN_BASE_URL,
            from: ALERT_FROM_EMAIL,
            resendKey: RESEND_API_KEY,
            telegramToken: TELEGRAM_BOT_TOKEN,
          }
        );
      } catch (err) {
        // Let them retry immediately after a failure — the cooldown is there
        // to stop repeat *deliveries*, not to punish a misconfiguration.
        lastTestAt.delete(req.params.id);
        const detail = (err as Error).message || "Delivery failed";
        log.warn({ err, contactId: snap.id, channel: c.channel }, "test notification failed");
        return reply.code(400).send({ error: detail });
      }

      log.info({ contactId: snap.id, channel: c.channel }, "test notification delivered");
      return { delivered: true, channel: c.channel, destination: c.destination };
    }
  );

  /** Remove a contact, and detach it from any monitor that named it. */
  app.delete<{ Params: { id: string } }>(
    "/v1/contacts/:id",
    { preHandler: requireAuth() },
    async (req, reply) => {
      const { orgId } = req.user!;
      const ref = col.alertContacts().doc(req.params.id);
      const snap = await ref.get();
      if (!snap.exists || snap.data()?.orgId !== orgId) {
        return reply.code(404).send({ error: "No such alert contact" });
      }

      // Leaving the id behind would make a monitor's list non-empty and
      // pointing at nothing, which reads as "explicitly chosen contacts" and
      // silences it — the exact failure this feature exists to fix.
      const monitors = await col
        .monitors()
        .where("orgId", "==", orgId)
        .where("alertContactIds", "array-contains", req.params.id)
        .get();

      const batch = col.monitors().firestore.batch();
      for (const m of monitors.docs) {
        batch.update(m.ref, {
          alertContactIds: (m.data().alertContactIds as string[]).filter(
            (id) => id !== req.params.id
          ),
          updatedAt: Timestamp.now(),
        });
      }
      batch.delete(ref);
      await batch.commit();

      log.info(
        { contactId: req.params.id, detachedFrom: monitors.size },
        "contact deleted"
      );
      return { deleted: true, detachedFrom: monitors.size };
    }
  );

  /**
   * Issue a confirmation link and send it over the contact's own channel.
   * Authenticated: only a member of the org may trigger a send, or this is an
   * open relay for sending mail to arbitrary addresses.
   */
  app.post<{ Params: { id: string } }>(
    "/v1/contacts/:id/verify",
    { preHandler: requireAuth() },
    async (req, reply) => {
      const { orgId } = req.user!;
      const ref = col.alertContacts().doc(req.params.id);
      const snap = await ref.get();
      const contact = snap.data();

      if (!snap.exists || contact?.orgId !== orgId) {
        return reply.code(404).send({ error: "No such alert contact" });
      }
      if (contact.verified) return { alreadyVerified: true };

      const lastSent: number = contact.verificationSentAt?.toMillis?.() ?? 0;
      if (Date.now() - lastSent < RESEND_COOLDOWN_MS) {
        return reply.code(429).send({
          error: "A confirmation was just sent. Wait a minute before trying again.",
        });
      }

      const token = randomBytes(32).toString("base64url");
      await ref.update({
        verificationTokenHash: hashToken(token),
        verificationSentAt: Timestamp.now(),
        verificationExpiresAt: Timestamp.fromMillis(Date.now() + TOKEN_TTL_MS),
      });

      try {
        await deliverVerification(
          {
            channel: String(contact.channel),
            destination: String(contact.destination),
            telegramChatId: contact.telegramChatId,
          },
          `${API_URL.replace(/\/$/, "")}/verify-contact?token=${token}`
        );
      } catch (err) {
        // Clear the token: leaving one behind that was never delivered means
        // the contact looks pending forever with no way to complete it.
        await ref.update({
          verificationTokenHash: null,
          verificationSentAt: null,
          verificationExpiresAt: null,
        });
        const detail =
          err instanceof BlockedTargetError
            ? err.message
            : (err as Error).message || "Could not reach that destination";
        log.warn({ err, contactId: req.params.id }, "verification send failed");
        return reply.code(400).send({ error: detail });
      }

      log.info({ contactId: req.params.id, channel: contact.channel }, "verification sent");
      return { sent: true, channel: contact.channel };
    }
  );

  /**
   * The link target. Unauthenticated by design — the token in the URL is the
   * credential, and the person confirming may not be the one who added it.
   */
  app.get<{ Querystring: { token?: string } }>("/verify-contact", async (req, reply) => {
    const token = String(req.query.token ?? "");
    reply.type("text/html");

    if (!token || token.length < 32) {
      return reply.code(400).send(page("Invalid link", "That confirmation link is malformed."));
    }

    const snap = await col
      .alertContacts()
      .where("verificationTokenHash", "==", hashToken(token))
      .limit(1)
      .get();

    if (snap.empty) {
      return reply
        .code(404)
        .send(page("Link not recognised", "It may have already been used."));
    }

    const doc = snap.docs[0];
    const contact = doc.data();
    const expires: number = contact.verificationExpiresAt?.toMillis?.() ?? 0;

    if (Date.now() > expires) {
      return reply
        .code(410)
        .send(page("Link expired", "Send yourself a new confirmation from the dashboard."));
    }

    await doc.ref.update({
      verified: true,
      verifiedAt: Timestamp.now(),
      verificationTokenHash: null,
      verificationExpiresAt: null,
    });

    log.info({ contactId: doc.id, channel: contact.channel }, "contact verified");
    return reply
      .code(200)
      .send(
        page("Contact confirmed", `${contact.destination} will now receive downtime alerts.`)
      );
  });

  /**
   * Register or update a mobile device push token (iOS / Android Flutter app).
   *
   * Authenticated by the user's Firebase token. Auto-verifies the device since
   * the token is registered directly from the authenticated client app.
   *
   * Idempotent by document id, not by query-then-insert. The old version read
   * for an existing token and inserted if none was found, which two concurrent
   * calls from the same device both passed — the check and the write were not
   * one operation. Writing to a deterministic id means the second request
   * overwrites the first instead of duplicating it.
   *
   * A duplicate row is not merely untidy: `queueAlerts` fans out over every
   * deliverable contact and `deliverableContactIds` does not dedupe by
   * destination, so two rows for one token send two pushes per incident.
   */
  app.post<{ Body: { token?: string; platform?: "ios" | "android"; name?: string } }>(
    "/v1/devices",
    { preHandler: requireAuth() },
    async (req, reply) => {
      const { orgId, uid } = req.user!;
      const token = String(req.body?.token ?? "").trim();
      const platform = req.body?.platform === "ios" ? "ios" : "android";
      const name =
        String(req.body?.name ?? "").trim().slice(0, 120) ||
        `${platform === "ios" ? "iOS" : "Android"} Device`;

      if (!token || token.length < 10) {
        return reply.code(400).send({ error: "Invalid device token" });
      }

      const ref = col.alertContacts().doc(deviceDocId(orgId, token));

      // Does a row already exist *anywhere in this org* for this token? If so
      // the seat is already used and the cap must not count it twice.
      const rowsForToken = await col
        .alertContacts()
        .where("orgId", "==", orgId)
        .where("channel", "==", "fcm")
        .where("destination", "==", token)
        .get();

      // Rows created by the old race, plus rows carrying the id the previous
      // naming scheme would have produced. Both are superseded by `ref`.
      const stale = rowsForToken.docs
        .filter((d) => d.id !== ref.id)
        .map((d) => d.id);
      const superseded = pickDuplicateFcmRows(
        rowsForToken.docs.map((d) => ({
          id: d.id,
          token: String(d.data().destination ?? ""),
          createdAt: d.data().createdAt?.toMillis?.() ?? null,
        }))
      );

      // Retire this *device's* previous token — same uid, same platform. A
      // token rotates on reinstall or an FCM refresh and the app reports the
      // new one, but nothing removed the old row, so a single device piled up
      // identically-named entries in Settings, each still able to page it.
      // Scoped to platform: an account on both an iPhone and an Android has a
      // legitimate token per platform, and matching on uid alone would silence
      // the other device the moment either launched.
      const sameDevice = pickSupersededFcmRows(
        (
          await col.alertContacts().where("orgId", "==", orgId).where("uid", "==", uid).get()
        ).docs.map((d) => ({
          id: d.id,
          token: String(d.data().destination ?? ""),
          uid: d.data().uid ?? null,
          platform: d.data().platform ?? null,
          channel: String(d.data().channel ?? ""),
        })),
        { id: ref.id, token, uid, platform }
      );

      const staleIds = new Set([...stale, ...superseded, ...sameDevice]);
      if (staleIds.size) {
        const batch = col.alertContacts().firestore.batch();
        for (const id of staleIds) batch.delete(col.alertContacts().doc(id));
        await batch.commit();
        log.info(
          { orgId, removed: staleIds.size, platform },
          "retired superseded push registrations"
        );
      }

      // Seat accounting after the cleanup, so a re-registration is free and
      // the cap is measured against distinct devices.
      if (rowsForToken.empty) {
        const existingCount = await col.alertContacts().where("orgId", "==", orgId).get();
        if (existingCount.size >= MAX_CONTACTS) {
          return reply
            .code(409)
            .send({ error: `An organisation can have at most ${MAX_CONTACTS} alert contacts` });
        }
      }

      await ref.set(
        {
          orgId,
          uid,
          channel: "fcm",
          name,
          destination: token,
          fcmToken: token,
          platform,
          enabled: true,
          verified: true,
          updatedAt: Timestamp.now(),
          // `createdAt` is only ever stamped once, so a re-registration keeps
          // the original date and duplicate cleanup stays deterministic.
          createdAt: rowsForToken.empty ? Timestamp.now() : rowsForToken.docs[0].data().createdAt,
        },
        { merge: true }
      );

      log.info({ contactId: ref.id, platform, orgId }, "mobile device registered for push alerts");
      return reply.code(201).send({ id: ref.id, registered: true });
    }
  );

  /** Unregister a device push token on logout or app removal */
  app.delete<{ Params: { token?: string }; Querystring: { token?: string }; Body?: { token?: string } }>(
    "/v1/devices/:token?",
    { preHandler: requireAuth() },
    async (req, reply) => {
      const { orgId } = req.user!;
      const raw = req.params?.token || req.query?.token || (req.body as any)?.token || "";
      let token = "";
      try {
        token = decodeURIComponent(raw);
      } catch {
        token = raw;
      }

      if (!token) return reply.code(400).send({ error: "Missing device token" });

      const snap = await col
        .alertContacts()
        .where("orgId", "==", orgId)
        .where("channel", "==", "fcm")
        .where("destination", "==", token)
        .get();

      const batch = col.alertContacts().firestore.batch();
      for (const d of snap.docs) {
        batch.delete(d.ref);
      }
      await batch.commit();

      return reply.code(200).send({ unregistered: true });
    }
  );
}
