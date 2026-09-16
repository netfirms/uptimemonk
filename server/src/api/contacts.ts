import type { FastifyInstance } from "fastify";
import { createHash, randomBytes } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import { col } from "../sync/firebase.js";
import { requireAuth } from "./auth.js";
import { assertSafeUrl, BlockedTargetError } from "../lib/targetGuard.js";
import { log } from "../lib/log.js";
import {
  ALERT_FROM_EMAIL,
  API_URL,
  APP_URL,
  RESEND_API_KEY,
  TELEGRAM_BOT_TOKEN,
  USER_AGENT,
} from "../config.js";

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
/** Stops the endpoint being used to send someone repeated mail. */
const RESEND_COOLDOWN_MS = 60_000;

const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

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
    case "email":
      if (!RESEND_API_KEY) throw new Error("Email is not configured on this server yet");
      await postJson(
        "https://api.resend.com/emails",
        {
          from: ALERT_FROM_EMAIL,
          to: contact.destination,
          subject: "Confirm your UptimeMonke alert contact",
          text,
        },
        { authorization: `Bearer ${RESEND_API_KEY}` }
      );
      return;

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
}
