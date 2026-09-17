import { test, describe, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";

process.env.RECAPTCHA_SECRET = "test-secret";
process.env.RECAPTCHA_MIN_SCORE = "0.5";

const { verifyRecaptcha, recaptchaEnabled } = await import("./recaptcha.js");

const realFetch = globalThis.fetch;
let reply: unknown = {};
let status = 200;

before(() => {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify(reply), { status })) as typeof fetch;
});
after(() => {
  globalThis.fetch = realFetch;
});
beforeEach(() => {
  status = 200;
});

describe("reCAPTCHA verification", () => {
  test("it is on, because a secret is set", () => {
    assert.equal(recaptchaEnabled(), true);
  });

  test("a good token with a good score passes", async () => {
    reply = { success: true, score: 0.9, action: "signup" };
    const v = await verifyRecaptcha("tok", "signup");
    assert.equal(v.ok, true);
    assert.equal(v.score, 0.9);
  });

  test("a low score is refused", async () => {
    reply = { success: true, score: 0.1, action: "signup" };
    const v = await verifyRecaptcha("tok", "signup");
    assert.equal(v.ok, false);
    assert.match(v.reason!, /below/);
  });

  test("a token minted for a different action is refused", async () => {
    // Without this, a token from any other page — or any other site sharing
    // the key — would be accepted here, which is most of the point of v3.
    reply = { success: true, score: 0.9, action: "contact-form" };
    const v = await verifyRecaptcha("tok", "signup");
    assert.equal(v.ok, false);
    assert.match(v.reason!, /action was contact-form/);
  });

  test("Google rejecting the token is refused", async () => {
    reply = { success: false, "error-codes": ["invalid-input-response"] };
    const v = await verifyRecaptcha("tok", "signup");
    assert.equal(v.ok, false);
    assert.match(v.reason!, /invalid-input-response/);
  });

  test("a missing token is refused", async () => {
    assert.equal((await verifyRecaptcha(undefined, "signup")).ok, false);
  });

  test("an unreachable verifier fails OPEN", async () => {
    // An outage at a spam filter is not a reason to stop people signing up.
    const saved = globalThis.fetch;
    globalThis.fetch = (async () => {
      throw new Error("network down");
    }) as typeof fetch;
    const v = await verifyRecaptcha("tok", "signup");
    assert.equal(v.ok, true);
    assert.match(v.reason!, /unreachable/);
    globalThis.fetch = saved;
  });

  test("a missing score is treated as zero, not as a pass", async () => {
    reply = { success: true, action: "signup" };
    assert.equal((await verifyRecaptcha("tok", "signup")).ok, false);
  });
});
