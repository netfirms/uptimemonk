import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { randomBytes, createHash } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import { col } from "../lib/firestore";
import { assertSafeUrl } from "../lib/targetGuard";
import {
  ALERT_FROM_EMAIL,
  APP_URL,
  FUNCTIONS_BASE_URL,
  PRIMARY_REGION,
  RESEND_API_KEY,
  TELEGRAM_BOT_TOKEN,
  USER_AGENT,
} from "../config";
import type { AlertContact } from "../types";

/**
 * Alert-contact verification.
 *
 * `sendAlerts` filters on `contact.verified`, and nothing ever set it except
 * the signup bootstrap — so every alert contact a customer added themselves
 * was silently dropped. Monitoring that never pages anyone is worse than no
 * monitoring, because you believe you are covered.
 *
 * Verification also closes an abuse route: without it, anyone could point
 * alerts at an address or webhook they do not own and use the product as a
 * free way to send mail to strangers.
 */

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
/** Don't let a user re-send verification faster than this. */
const RESEND_COOLDOWN_MS = 60 * 1000;

const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

function verificationMessage(contact: AlertContact, link: string): string {
  return [
    `Confirm this ${contact.channel} contact for UptimeMonk.`,
    ``,
    `Someone added "${contact.destination}" to receive downtime alerts.`,
    `If that was you, confirm it here:`,
    ``,
    link,
    ``,
    `The link expires in 24 hours. If this wasn't you, ignore this message —`,
    `no alerts will be sent to this destination until it is confirmed.`,
  ].join("\n");
}

async function postJson(
  url: string,
  body: unknown,
  headers: Record<string, string> = {}
) {
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

/** Send the confirmation link over whichever channel is being verified. */
async function deliverVerification(
  contact: AlertContact,
  link: string,
  secrets: { resendKey?: string; telegramToken?: string }
): Promise<void> {
  const text = verificationMessage(contact, link);

  switch (contact.channel) {
    case "email": {
      if (!secrets.resendKey) throw new Error("RESEND_API_KEY not configured");
      await postJson(
        "https://api.resend.com/emails",
        {
          from: ALERT_FROM_EMAIL.value(),
          to: contact.destination,
          subject: "Confirm your UptimeMonk alert contact",
          text,
        },
        { authorization: `Bearer ${secrets.resendKey}` }
      );
      return;
    }
    case "slack":
      await assertSafeUrl(contact.destination);
      await postJson(contact.destination, { text });
      return;
    case "discord":
      await assertSafeUrl(contact.destination);
      await postJson(contact.destination, { username: "UptimeMonk", content: text });
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
    case "telegram": {
      if (!secrets.telegramToken) throw new Error("TELEGRAM_BOT_TOKEN not configured");
      await postJson(
        `https://api.telegram.org/bot${secrets.telegramToken}/sendMessage`,
        {
          chat_id: contact.telegramChatId ?? contact.destination,
          text,
          disable_web_page_preview: true,
        }
      );
      return;
    }
    case "push":
      throw new HttpsError(
        "unimplemented",
        "Push contacts are verified by the device that registered them"
      );
    default:
      throw new HttpsError("invalid-argument", `Unknown channel: ${contact.channel}`);
  }
}

/** Issues a confirmation link and sends it over the contact's own channel. */
export const sendContactVerification = onCall(
  {
    region: PRIMARY_REGION,
    secrets: [RESEND_API_KEY, TELEGRAM_BOT_TOKEN],
  },
  async (req) => {
    if (!req.auth) throw new HttpsError("unauthenticated", "Sign in first");
    const orgId = req.auth.token.orgId as string | undefined;
    const contactId = (req.data?.contactId as string) ?? "";
    if (!orgId) throw new HttpsError("failed-precondition", "No organisation on token");
    if (!contactId) throw new HttpsError("invalid-argument", "contactId is required");

    const ref = col.alertContacts().doc(contactId);
    const snap = await ref.get();
    const contact = snap.data() as AlertContact | undefined;
    if (!snap.exists || contact?.orgId !== orgId) {
      throw new HttpsError("not-found", "No such alert contact");
    }
    if (contact.verified) return { alreadyVerified: true };

    const lastSent = contact.verificationSentAt?.toMillis() ?? 0;
    if (Date.now() - lastSent < RESEND_COOLDOWN_MS) {
      throw new HttpsError(
        "resource-exhausted",
        "A confirmation was just sent. Wait a minute before trying again."
      );
    }

    const token = randomBytes(32).toString("base64url");
    const now = Timestamp.now();
    await ref.update({
      verificationTokenHash: hashToken(token),
      verificationSentAt: now,
      verificationExpiresAt: Timestamp.fromMillis(Date.now() + TOKEN_TTL_MS),
    });

    await deliverVerification(contact, `${FUNCTIONS_BASE_URL.value()}/verifyContact?token=${token}`, {
      resendKey: RESEND_API_KEY.value(),
      telegramToken: TELEGRAM_BOT_TOKEN.value(),
    });

    logger.info("verification sent", { contactId, channel: contact.channel });
    return { sent: true, channel: contact.channel };
  }
);

/** The link target. Marks the contact verified and burns the token. */
export const verifyContact = onRequest(
  { region: PRIMARY_REGION, cors: false, memory: "256MiB", maxInstances: 10 },
  async (req, res) => {
    const token = String(req.query.token ?? "");
    const reply = (status: number, heading: string, detail: string) => {
      res.status(status).send(
        `<!doctype html><meta charset="utf-8">` +
          `<meta name="viewport" content="width=device-width,initial-scale=1">` +
          `<title>${heading}</title>` +
          `<div style="font:16px/1.5 system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 1.5rem">` +
          `<h1 style="font-size:1.4rem;margin:0 0 .5rem">${heading}</h1>` +
          `<p style="color:#555;margin:0 0 1.5rem">${detail}</p>` +
          `<a href="${APP_URL.value()}" style="color:#2F6F62">Back to UptimeMonk</a></div>`
      );
    };

    if (!token || token.length < 32) {
      reply(400, "Invalid link", "That confirmation link is malformed.");
      return;
    }

    const snap = await col
      .alertContacts()
      .where("verificationTokenHash", "==", hashToken(token))
      .limit(1)
      .get();

    if (snap.empty) {
      reply(404, "Link not recognised", "It may have already been used.");
      return;
    }

    const doc = snap.docs[0];
    const contact = doc.data() as AlertContact;
    const expires = contact.verificationExpiresAt?.toMillis() ?? 0;
    if (Date.now() > expires) {
      reply(410, "Link expired", "Send yourself a new confirmation from the dashboard.");
      return;
    }

    await doc.ref.update({
      verified: true,
      verifiedAt: Timestamp.now(),
      verificationTokenHash: null,
      verificationExpiresAt: null,
    });

    logger.info("contact verified", { contactId: doc.id, channel: contact.channel });
    reply(
      200,
      "Contact confirmed",
      `${contact.destination} will now receive downtime alerts.`
    );
  }
);
