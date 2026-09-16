import { ALERT_FROM_EMAIL, APP_URL, USER_AGENT } from "../config.js";
import { assertSafeUrl } from "../lib/targetGuard.js";
import type { AlertContact, Incident, Monitor } from "../types.js";
import { humanDuration } from "../lib/time.js";

export interface AlertPayload {
  event: "down" | "up";
  monitor: Monitor;
  monitorId: string;
  incident: Incident;
  incidentId: string;
}

export function subjectFor(p: AlertPayload): string {
  return p.event === "down"
    ? `🔴 DOWN — ${p.monitor.name}`
    : `🟢 UP — ${p.monitor.name} is back`;
}

export function bodyFor(p: AlertPayload): string {
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

/** Resend — swap for SendGrid/Postmark by changing this one function. */
export async function sendEmail(
  to: string,
  p: AlertPayload,
  apiKey: string
): Promise<void> {
  await postJson(
    "https://api.resend.com/emails",
    {
      from: ALERT_FROM_EMAIL,
      to,
      subject: subjectFor(p),
      text: bodyFor(p),
    },
    { authorization: `Bearer ${apiKey}` }
  );
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
        color: p.event === "down" ? 0xef4444 : 0x22c55e,
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

export async function deliver(
  contact: AlertContact,
  p: AlertPayload,
  secrets: { resendKey?: string; telegramToken?: string }
): Promise<void> {
  switch (contact.channel) {
    case "email":
      if (!secrets.resendKey) throw new Error("RESEND_API_KEY not configured");
      return sendEmail(contact.destination, p, secrets.resendKey);
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
    default:
      throw new Error(`Unknown channel: ${contact.channel}`);
  }
}
