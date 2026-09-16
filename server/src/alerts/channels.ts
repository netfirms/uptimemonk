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
/**
 * Mailgun's send endpoint.
 *
 * Form-encoded, not JSON — the v3 messages API does not accept a JSON body,
 * and posting one gets a 400 that reads like an auth failure. Auth is HTTP
 * Basic with the literal username `api` and the private key as the password.
 */
export async function sendEmailMailgun(
  to: string,
  p: AlertPayload,
  opts: { apiKey: string; domain: string; baseUrl: string; from: string }
): Promise<void> {
  const form = new URLSearchParams({
    from: opts.from,
    to,
    subject: subjectFor(p),
    text: bodyFor(p),
  });

  const res = await fetch(
    `${opts.baseUrl.replace(/\/$/, "")}/v3/${encodeURIComponent(opts.domain)}/messages`,
    {
      method: "POST",
      headers: {
        authorization: `Basic ${Buffer.from(`api:${opts.apiKey}`).toString("base64")}`,
        "content-type": "application/x-www-form-urlencoded",
        "user-agent": USER_AGENT,
      },
      body: form,
      signal: AbortSignal.timeout(15_000),
    }
  );

  if (!res.ok) {
    const detail = (await res.text()).slice(0, 200);
    // Never include the key: this string ends up in `alert_outbox.last_error`
    // and in the logs.
    throw new Error(`Mailgun responded ${res.status}: ${detail}`);
  }
}

export async function sendEmailResend(
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

/**
 * Send an alert email through whichever provider is configured.
 *
 * Mailgun wins when it has a key. Neither being configured is a clear error
 * rather than a silent no-op — an alert that is not sent must fail loudly
 * enough to land in the outbox's `last_error`.
 */
export async function sendEmail(
  to: string,
  p: AlertPayload,
  secrets: { mailgunKey?: string; mailgunDomain?: string; mailgunBaseUrl?: string;
             from?: string; resendKey?: string }
): Promise<void> {
  if (secrets.mailgunKey) {
    return sendEmailMailgun(to, p, {
      apiKey: secrets.mailgunKey,
      domain: secrets.mailgunDomain || "",
      baseUrl: secrets.mailgunBaseUrl || "https://api.mailgun.net",
      from: secrets.from || ALERT_FROM_EMAIL,
    });
  }
  if (secrets.resendKey) return sendEmailResend(to, p, secrets.resendKey);
  throw new Error("No email provider configured (set MAILGUN_API_KEY or RESEND_API_KEY)");
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
    default:
      throw new Error(`Unknown channel: ${contact.channel}`);
  }
}
