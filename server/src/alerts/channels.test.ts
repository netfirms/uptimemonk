import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  subjectFor,
  bodyFor,
  sendSlack,
  sendDiscord,
  sendTelegram,
  sendWebhook,
  deliver,
  type AlertPayload,
  type AlertSecrets,
} from "./channels.js";
import type { AlertContact, Monitor } from "../types.js";

const downPayload: AlertPayload = {
  event: "down",
  monitorId: "mon-123",
  incidentId: "inc-456",
  monitor: {
    id: "mon-123",
    name: "API Service",
    type: "http",
    target: "https://api.example.com/health",
  } as Monitor,
  incident: {
    id: "inc-456",
    cause: "HTTP 500 Internal Server Error",
    startedAt: 1700000000000,
  } as any,
};

const upPayload: AlertPayload = {
  event: "up",
  monitorId: "mon-123",
  incidentId: "inc-456",
  monitor: {
    id: "mon-123",
    name: "API Service",
    type: "http",
    target: "https://api.example.com/health",
  } as Monitor,
  incident: {
    id: "inc-456",
    cause: "HTTP 500 Internal Server Error",
    startedAt: 1700000000000,
    resolvedAt: 1700000120000,
    durationSeconds: 120,
  } as any,
};

const realFetch = globalThis.fetch;
let calls: { url: string; headers: Record<string, string>; body: any }[] = [];

beforeEach(() => {
  calls = [];
  globalThis.fetch = (async (input: any, init: any) => {
    const headers = Object.fromEntries(
      Object.entries((init?.headers ?? {}) as Record<string, string>).map(([k, v]) => [
        k.toLowerCase(),
        String(v),
      ])
    );
    let body = init?.body;
    try {
      body = JSON.parse(String(init?.body ?? ""));
    } catch {}
    calls.push({ url: String(input), headers, body });
    return new Response("{}", { status: 200 });
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("Alert Notification Channels", () => {
  test("subjectFor formats DOWN and UP events with icons", () => {
    assert.equal(subjectFor(downPayload), "🔴 DOWN — API Service");
    assert.equal(subjectFor(upPayload), "🟢 UP — API Service is back");
  });

  test("bodyFor includes target, cause, timestamp, and duration on recovery", () => {
    const downBody = bodyFor(downPayload);
    assert.match(downBody, /API Service is DOWN/);
    assert.match(downBody, /Target:\s+https:\/\/api\.example\.com\/health/);
    assert.match(downBody, /Cause:\s+HTTP 500/);

    const upBody = bodyFor(upPayload);
    assert.match(upBody, /API Service is back UP/);
    assert.match(upBody, /Downtime:\s+2m/);
  });

  test("sendSlack formats Slack webhook payload with header and action blocks", async () => {
    await sendSlack("https://hooks.slack.com/services/T00/B00/X00", downPayload);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://hooks.slack.com/services/T00/B00/X00");
    assert.equal(calls[0].body.text, "🔴 DOWN — API Service");
    assert.equal(calls[0].body.blocks[0].type, "header");
  });

  test("sendDiscord formats Discord webhook payload with embedded color", async () => {
    await sendDiscord("https://discord.com/api/webhooks/123/abc", downPayload);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://discord.com/api/webhooks/123/abc");
    assert.equal(calls[0].body.username, "UptimeMonke");
    assert.equal(calls[0].body.embeds[0].color, 0xef4444); // red on down

    await sendDiscord("https://discord.com/api/webhooks/123/abc", upPayload);
    assert.equal(calls[1].body.embeds[0].color, 0x22c55e); // green on up
  });

  test("sendTelegram sends markdown formatted message to bot API", async () => {
    await sendTelegram("12345678", downPayload, "bot-token-xyz");
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://api.telegram.org/botbot-token-xyz/sendMessage");
    assert.equal(calls[0].body.chat_id, "12345678");
    assert.equal(calls[0].body.parse_mode, "Markdown");
  });

  test("sendWebhook formats standard customer webhook schema", async () => {
    await sendWebhook("https://webhook.site/custom-endpoint", downPayload);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://webhook.site/custom-endpoint");
    assert.equal(calls[0].body.event, "monitor.down");
    assert.equal(calls[0].body.monitor.name, "API Service");
    assert.equal(calls[0].body.incident.cause, "HTTP 500 Internal Server Error");
  });

  test("deliver routes to respective channels", async () => {
    const secrets: AlertSecrets = {
      telegramToken: "tg-tok",
      mailgunKey: "mg-key",
      mailgunDomain: "mg.example.com",
    };

    const slackContact: AlertContact = {
      id: "c-slack",
      orgId: "org-1",
      channel: "slack",
      name: "Slack Ops",
      destination: "https://hooks.slack.com/services/T00/B00/X01",
      enabled: true,
      verified: true,
    };
    await deliver(slackContact, downPayload, secrets);
    assert.equal(calls.length, 1);

    const discordContact: AlertContact = {
      id: "c-discord",
      orgId: "org-1",
      channel: "discord",
      name: "Discord Alerts",
      destination: "https://discord.com/api/webhooks/456/def",
      enabled: true,
      verified: true,
    };
    await deliver(discordContact, downPayload, secrets);
    assert.equal(calls.length, 2);

    const tgContact: AlertContact = {
      id: "c-tg",
      orgId: "org-1",
      channel: "telegram",
      name: "Telegram Alerts",
      destination: "tg-dest",
      telegramChatId: "987654",
      enabled: true,
      verified: true,
    };
    await deliver(tgContact, downPayload, secrets);
    assert.equal(calls.length, 3);

    const webhookContact: AlertContact = {
      id: "c-hook",
      orgId: "org-1",
      channel: "webhook",
      name: "Webhook Integration",
      destination: "https://webhook.site/test-hook",
      enabled: true,
      verified: true,
    };
    await deliver(webhookContact, downPayload, secrets);
    assert.equal(calls.length, 4);
  });

  test("deliver throws error when channel is unsupported or missing secrets", async () => {
    const tgContact: AlertContact = {
      id: "c-tg-nosecret",
      orgId: "org-1",
      channel: "telegram",
      name: "Telegram No Secret",
      destination: "12345",
      enabled: true,
      verified: true,
    };
    await assert.rejects(
      async () => deliver(tgContact, downPayload, {}),
      /TELEGRAM_BOT_TOKEN not configured/i
    );

    const unknownContact: AlertContact = {
      id: "c-unknown",
      orgId: "org-1",
      channel: "pagerduty" as any,
      name: "Unknown Pager",
      destination: "https://pd.example.com",
      enabled: true,
      verified: true,
    };
    await assert.rejects(
      async () => deliver(unknownContact, downPayload, {}),
      /Unknown channel: pagerduty/i
    );
  });
});
