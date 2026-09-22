import { ALERT_FROM_EMAIL, APP_URL, USER_AGENT } from "../config.js";
import { assertSafeUrl } from "../lib/targetGuard.js";
import type { AlertContact, Incident, Monitor } from "../types.js";
import { humanDuration } from "../lib/time.js";
import { messaging } from "../sync/firebase.js";

export interface AlertPayload {
  event: "down" | "up" | "cert";
  monitor: Monitor;
  monitorId: string;
  incident: Incident;
  incidentId: string;
}

export function subjectFor(p: AlertPayload): string {
  // A certificate warning is not an outage and must not read like one. The
  // site is serving fine; something needs renewing before it stops.
  if (p.event === "cert") return `🟡 CERT — ${p.monitor.name} expires soon`;
  return p.event === "down"
    ? `🔴 DOWN — ${p.monitor.name}`
    : `🟢 UP — ${p.monitor.name} is back`;
}

export function bodyFor(p: AlertPayload): string {
  if (p.event === "cert") {
    return [
      `${p.monitor.name} is still up — this is a certificate warning.`,
      ``,
      `Host:     ${p.monitor.target}`,
      `Detail:   ${p.incident.cause}`,
      ``,
      `Renew before it expires, or the site will start failing for visitors.`,
    ].join("\n");
  }

  const when = p.event === "down" ? p.incident.startedAt : p.incident.resolvedAt;
  const whenIso = new Date(when ?? Date.now()).toISOString();
  const lines = [
    p.event === "down"
      ? `${p.monitor.name} is DOWN.`
      : `${p.monitor.name} is back UP.`,
    ``,
    `Target:   ${p.monitor.target}`,
    `Cause:    ${p.incident.cause}`,
    `When:     ${whenIso}`,
  ];
  if (p.event === "up" && p.incident.durationSeconds != null) {
    lines.push(`Downtime: ${humanDuration(p.incident.durationSeconds)}`);
  }
  lines.push(``, `${APP_URL}/monitors/${p.monitorId}`);
  return lines.join("\n");
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

/**
 * Same as postJson, for URLs the customer supplied. Webhook, Slack and Discord
 * destinations are arbitrary URLs we POST to from inside Google's network, so
 * they get the same guard as a probe target — otherwise "alert contact" is a
 * second route to the metadata server.
 */
async function postJsonToUserUrl(
  url: string,
  body: unknown,
  headers: Record<string, string> = {}
) {
  await assertSafeUrl(url);
  return postJson(url, body, headers);
}

export interface EmailSecrets {
  mailgunKey?: string;
  mailgunDomain?: string;
  mailgunBaseUrl?: string;
  from?: string;
  resendKey?: string;
}

/**
 * Send an arbitrary subject and body through whichever provider is configured.
 *
 * Extracted from `sendEmail` because not everything this service mails is an
 * alert. `sendEmail` derives its subject from an incident, so anything else
 * routed through it arrives looking like an outage. `contacts.ts` avoided
 * that by inlining its own copy of the Mailgun call — a second copy of the
 * form-encoding and the auth header. This is the one place that knows how to
 * talk to a provider.
 *
 * Mailgun wins when it has a key. Neither being configured is a clear error
 * rather than a silent no-op — mail that is not sent must fail loudly enough
 * to land in the caller's error path.
 */
export async function sendPlainEmail(
  to: string,
  subject: string,
  text: string,
  secrets: EmailSecrets
): Promise<void> {
  if (secrets.mailgunKey) {
    const domain = secrets.mailgunDomain || "";
    const baseUrl = (secrets.mailgunBaseUrl || "https://api.mailgun.net").replace(/\/$/, "");
    const res = await fetch(`${baseUrl}/v3/${encodeURIComponent(domain)}/messages`, {
      method: "POST",
      headers: {
        authorization: `Basic ${Buffer.from(`api:${secrets.mailgunKey}`).toString("base64")}`,
        "content-type": "application/x-www-form-urlencoded",
        "user-agent": USER_AGENT,
      },
      body: new URLSearchParams({
        from: secrets.from || ALERT_FROM_EMAIL,
        to,
        subject,
        text,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      // Never include the key: this string reaches logs and, for alerts,
      // `alert_outbox.last_error`.
      throw new Error(`Mailgun responded ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    return;
  }

  if (secrets.resendKey) {
    await postJson(
      "https://api.resend.com/emails",
      { from: secrets.from || ALERT_FROM_EMAIL, to, subject, text },
      { authorization: `Bearer ${secrets.resendKey}` }
    );
    return;
  }

  throw new Error("No email provider configured (set MAILGUN_API_KEY or RESEND_API_KEY)");
}

/** Send an alert email. Subject and body come from the incident. */
export async function sendEmail(
  to: string,
  p: AlertPayload,
  secrets: EmailSecrets
): Promise<void> {
  return sendPlainEmail(to, subjectFor(p), bodyFor(p), secrets);
}

export async function sendSlack(webhookUrl: string, p: AlertPayload): Promise<void> {
  await postJsonToUserUrl(webhookUrl, {
    text: subjectFor(p),
    blocks: [
      { type: "header", text: { type: "plain_text", text: subjectFor(p) } },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Target*\n${p.monitor.target}` },
          { type: "mrkdwn", text: `*Cause*\n${p.incident.cause}` },
        ],
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Open monitor" },
            url: `${APP_URL}/monitors/${p.monitorId}`,
          },
        ],
      },
    ],
  });
}

export async function sendDiscord(webhookUrl: string, p: AlertPayload): Promise<void> {
  await postJsonToUserUrl(webhookUrl, {
    username: "UptimeMonke",
    embeds: [
      {
        title: subjectFor(p),
        description: bodyFor(p),
        color: p.event === "down" ? 0xef4444 : p.event === "cert" ? 0xf59e0b : 0x22c55e,
        url: `${APP_URL}/monitors/${p.monitorId}`,
      },
    ],
  });
}

export async function sendTelegram(
  chatId: string,
  p: AlertPayload,
  botToken: string
): Promise<void> {
  await postJson(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    chat_id: chatId,
    text: `*${subjectFor(p)}*\n\`\`\`\n${bodyFor(p)}\n\`\`\``,
    parse_mode: "Markdown",
    disable_web_page_preview: true,
  });
}

/**
 * Generic webhook. Keep this payload shape stable — customers build on it.
 * Signing it (HMAC over the body with a per-contact secret) is the next step.
 */
export async function sendWebhook(url: string, p: AlertPayload): Promise<void> {
  await postJsonToUserUrl(url, {
    event: `monitor.${p.event}`,
    monitor: {
      id: p.monitorId,
      name: p.monitor.name,
      type: p.monitor.type,
      target: p.monitor.target,
    },
    incident: {
      id: p.incidentId,
      cause: p.incident.cause,
      startedAt: new Date(p.incident.startedAt).toISOString(),
      resolvedAt: p.incident.resolvedAt
        ? new Date(p.incident.resolvedAt).toISOString()
        : null,
      durationSeconds: p.incident.durationSeconds ?? null,
    },
    sentAt: new Date().toISOString(),
  });
}

/** Everything the channels need that does not belong in a module import, so
 *  a test can drive delivery without touching process env. */
export interface AlertSecrets {
  mailgunKey?: string;
  mailgunDomain?: string;
  mailgunBaseUrl?: string;
  from?: string;
  resendKey?: string;
  telegramToken?: string;
}

/**
 * Mobile push notification via Firebase Cloud Messaging.
 * High-priority alert with custom sound and structured data for Flutter routing.
 */
export async function sendFcm(token: string, p: AlertPayload): Promise<void> {
  const title = subjectFor(p);
  const body = bodyFor(p);

  await messaging().send({
    token,
    notification: {
      title,
      body,
    },
    data: {
      event: p.event,
      monitorId: p.monitorId,
      monitorName: p.monitor.name,
      monitorTarget: p.monitor.target,
      incidentId: p.incidentId,
      startedAt: String(p.incident.startedAt ?? Date.now()),
      resolvedAt: p.incident.resolvedAt ? String(p.incident.resolvedAt) : "",
      cause: p.incident.cause || "",
      click_action: "FLUTTER_NOTIFICATION_CLICK",
    },
    android: {
      priority: "high",
      notification: {
        channelId: "uptime_alerts",
        sound: "default",
        priority: "max",
        defaultVibrateTimings: true,
      },
    },
    apns: {
      headers: {
        "apns-priority": "10",
      },
      payload: {
        aps: {
          sound: "default",
          interruptionLevel: "time-sensitive",
        },
      },
    },
  });
}

export async function deliver(
  contact: AlertContact,
  p: AlertPayload,
  secrets: AlertSecrets
): Promise<void> {
  switch (contact.channel) {
    case "email":
      return sendEmail(contact.destination, p, secrets);
    case "slack":
      return sendSlack(contact.destination, p);
    case "discord":
      return sendDiscord(contact.destination, p);
    case "telegram":
      if (!secrets.telegramToken) throw new Error("TELEGRAM_BOT_TOKEN not configured");
      return sendTelegram(
        contact.telegramChatId ?? contact.destination,
        p,
        secrets.telegramToken
      );
    case "webhook":
      return sendWebhook(contact.destination, p);
    case "fcm":
      return sendFcm(contact.fcmToken ?? contact.destination, p);
    default:
      throw new Error(`Unknown channel: ${contact.channel}`);
  }
}
