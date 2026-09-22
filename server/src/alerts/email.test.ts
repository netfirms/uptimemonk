import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { sendEmail, sendPlainEmail, type AlertSecrets, type AlertPayload } from "./channels.js";

/**
 * Email transport selection.
 *
 * `fetch` is stubbed throughout: these assert which provider is called and
 * what is put on the wire, so nothing leaves the machine and no real key is
 * needed.
 */

const payload = {
  event: "down",
  monitorId: "m1",
  incidentId: "i1",
  monitor: { id: "m1", name: "Checkout API", target: "https://shop.example.com" },
  incident: { id: "i1", startedAt: Date.now(), cause: "connect ECONNREFUSED" },
} as unknown as AlertPayload;

const realFetch = globalThis.fetch;
let calls: { url: string; headers: Record<string, string>; body: string }[] = [];

beforeEach(() => {
  calls = [];
  globalThis.fetch = (async (input: any, init: any) => {
    const headers = Object.fromEntries(
      Object.entries((init?.headers ?? {}) as Record<string, string>).map(([k, v]) => [
        k.toLowerCase(),
        String(v),
      ])
    );
    calls.push({ url: String(input), headers, body: String(init?.body ?? "") });
    return new Response("{}", { status: 200 });
  }) as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

const mailgun: AlertSecrets = {
  mailgunKey: "key-test",
  mailgunDomain: "mg.example.com",
  mailgunBaseUrl: "https://api.mailgun.net",
  from: "alerts@mg.example.com",
};

describe("email provider selection", () => {
  test("Mailgun is used when it has a key", async () => {
    await sendEmail("ops@example.com", payload, mailgun);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://api.mailgun.net/v3/mg.example.com/messages");
  });

  test("Mailgun wins over Resend when both are configured", async () => {
    await sendEmail("ops@example.com", payload, { ...mailgun, resendKey: "re_x" });
    assert.match(calls[0].url, /mailgun/);
  });

  test("Resend is the fallback when Mailgun has no key", async () => {
    await sendEmail("ops@example.com", payload, { resendKey: "re_x" });
    assert.equal(calls[0].url, "https://api.resend.com/emails");
  });

  test("no provider is a loud error, not a silent no-op", async () => {
    await assert.rejects(
      () => sendEmail("ops@example.com", payload, {}),
      /No email provider configured/
    );
    assert.equal(calls.length, 0);
  });
});

describe("the Mailgun request", () => {
  test("is form-encoded — a JSON body gets a 400 that looks like an auth failure", async () => {
    await sendEmail("ops@example.com", payload, mailgun);
    assert.match(calls[0].headers["content-type"], /x-www-form-urlencoded/);
    const form = new URLSearchParams(calls[0].body);
    assert.equal(form.get("to"), "ops@example.com");
    assert.equal(form.get("from"), "alerts@mg.example.com");
    assert.match(String(form.get("subject")), /Checkout API/);
  });

  test("authenticates as basic api:<key>, which is Mailgun's scheme", async () => {
    await sendEmail("ops@example.com", payload, mailgun);
    const auth = calls[0].headers["authorization"];
    assert.match(auth, /^Basic /);
    assert.equal(Buffer.from(auth.slice(6), "base64").toString(), "api:key-test");
  });

  test("an EU account's base URL is honoured", async () => {
    await sendEmail("ops@example.com", payload, {
      ...mailgun,
      mailgunBaseUrl: "https://api.eu.mailgun.net",
    });
    assert.match(calls[0].url, /^https:\/\/api\.eu\.mailgun\.net\//);
  });

  test("a failure never puts the key in the error", async () => {
    // This message is stored in `alert_outbox.last_error` and logged.
    globalThis.fetch = (async () =>
      new Response("Forbidden", { status: 401 })) as typeof fetch;

    await assert.rejects(
      () => sendEmail("ops@example.com", payload, mailgun),
      (err: Error) => {
        assert.match(err.message, /Mailgun responded 401/);
        assert.ok(!err.message.includes("key-test"), "leaked the API key");
        return true;
      }
    );
  });
});

/**
 * The generic sender.
 *
 * Extracted so not everything this service mails has to look like an
 * incident. These pin that an arbitrary subject survives to the wire — the
 * bug being guarded against is a signup notice going out titled "DOWN:".
 */
describe("sending a plain email", () => {
  let calls: Array<{ url: string; init: RequestInit }> = [];
  const realFetch = globalThis.fetch;

  beforeEach(() => {
    calls = [];
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      calls.push({ url: String(url), init });
      return { ok: true, status: 200, text: async () => "", json: async () => ({}) };
    }) as unknown as typeof fetch;
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  const mailgun = {
    mailgunKey: "key-abc",
    mailgunDomain: "mg.example.com",
    mailgunBaseUrl: "https://api.mailgun.net",
    from: "ops@example.com",
  };

  test("the caller's subject and body reach Mailgun unchanged", async () => {
    await sendPlainEmail("admin@example.com", "New signup: a@b.com", "body text", mailgun);

    assert.equal(calls.length, 1);
    const body = new URLSearchParams(String(calls[0].init.body));
    assert.equal(body.get("subject"), "New signup: a@b.com");
    assert.equal(body.get("text"), "body text");
    assert.equal(body.get("to"), "admin@example.com");
    assert.equal(body.get("from"), "ops@example.com");
  });

  test("it is form-encoded, not JSON — Mailgun rejects a JSON body", async () => {
    await sendPlainEmail("a@b.com", "s", "t", mailgun);
    const headers = calls[0].init.headers as Record<string, string>;
    assert.equal(headers["content-type"], "application/x-www-form-urlencoded");
  });

  test("the key never appears in the error text", async () => {
    // This string reaches the logs and alert_outbox.last_error.
    globalThis.fetch = (async () => ({
      ok: false,
      status: 401,
      text: async () => "Forbidden",
    })) as unknown as typeof fetch;

    await assert.rejects(
      () => sendPlainEmail("a@b.com", "s", "t", mailgun),
      (err: Error) => !err.message.includes("key-abc") && /401/.test(err.message)
    );
  });

  test("Resend is used when Mailgun has no key", async () => {
    await sendPlainEmail("a@b.com", "subj", "text", { resendKey: "re_x", from: "ops@example.com" });
    assert.match(calls[0].url, /api\.resend\.com/);
    const sent = JSON.parse(String(calls[0].init.body));
    assert.equal(sent.subject, "subj");
    assert.equal(sent.text, "text");
  });

  test("no provider configured is a loud failure, not a silent drop", async () => {
    await assert.rejects(
      () => sendPlainEmail("a@b.com", "s", "t", {}),
      /No email provider configured/
    );
    assert.equal(calls.length, 0);
  });

  test("an alert still gets its incident-derived subject", async () => {
    // sendEmail is now a wrapper, so this guards the wrapper still wraps.
    await sendEmail("a@b.com", payload, mailgun);
    const body = new URLSearchParams(String(calls[0].init.body));
    assert.match(String(body.get("subject")), /Checkout API/);
  });
});
