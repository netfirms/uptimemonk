import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { deliver, type AlertSecrets } from "../alerts/channels.js";
import type { AlertContact } from "../types.js";

/**
 * The test-notification payload.
 *
 * The point of the button is that it proves the *real* path works, so what
 * matters here is that it goes through `deliver()` with the production
 * secrets and comes out looking like a test rather than a real outage.
 */

const realFetch = globalThis.fetch;
let calls: { url: string; body: string }[] = [];

beforeEach(() => {
  calls = [];
  globalThis.fetch = (async (input: any, init: any) => {
    calls.push({ url: String(input), body: String(init?.body ?? "") });
    return new Response("{}", { status: 200 });
  }) as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

/** Mirrors `testPayload()` in api/contacts.ts. */
const payload = {
  event: "down",
  monitorId: "test",
  incidentId: "test",
  monitor: { id: "test", name: "UptimeMonke test notification", target: "https://uptimemonke.com" },
  incident: {
    id: "test",
    startedAt: Date.now(),
    cause: "This is a test. No monitor is down — you are checking that alerts reach you.",
  },
} as never;

const secrets: AlertSecrets = {
  mailgunKey: "key-test",
  mailgunDomain: "mg.example.com",
  mailgunBaseUrl: "https://api.mailgun.net",
  from: "alerts@mg.example.com",
};

const contact = (over: Partial<AlertContact> = {}): AlertContact =>
  ({
    id: "c1",
    orgId: "org1",
    channel: "email",
    name: "Ops",
    destination: "ops@example.com",
    enabled: true,
    verified: true,
    ...over,
  }) as AlertContact;

describe("test notification", () => {
  test("goes out over the contact's own channel", async () => {
    await deliver(contact(), payload, secrets);
    assert.match(calls[0].url, /mailgun/);
  });

  test("says plainly that it is a test, so it is not mistaken for an outage", async () => {
    await deliver(contact(), payload, secrets);
    const form = new URLSearchParams(calls[0].body);
    assert.match(String(form.get("subject")), /test notification/i);
    assert.match(String(form.get("text")), /This is a test/);
  });

  test("a webhook contact gets the same JSON an incident would produce", async () => {
    await deliver(
      contact({ channel: "webhook", destination: "https://example.com/hook" }),
      payload,
      secrets
    );
    const body = JSON.parse(calls[0].body);
    assert.equal(body.event, "monitor.down");
    assert.match(JSON.stringify(body), /test notification/i);
  });

  test("a provider failure surfaces its own words, not a generic message", async () => {
    // "domain not verified" is what tells someone what to fix; "delivery
    // failed" tells them nothing.
    globalThis.fetch = (async () =>
      new Response("Domain mg.example.com is not verified", { status: 403 })) as typeof fetch;

    await assert.rejects(
      () => deliver(contact(), payload, secrets),
      (err: Error) => {
        assert.match(err.message, /not verified/);
        assert.ok(!err.message.includes("key-test"), "leaked the API key");
        return true;
      }
    );
  });
});
