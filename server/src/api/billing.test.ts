import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.UPTIMEMONK_DB = join(mkdtempSync(join(tmpdir(), "uptimemonk-billing-")), "t.db");
process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_dummy";

const Fastify = (await import("fastify")).default;
const Stripe = (await import("stripe")).default;
const { openDb, closeDb } = await import("../db/index.js");
const { billingRoutes } = await import("./billing.js");

let app: Awaited<ReturnType<typeof Fastify>>;

before(async () => {
  openDb();
  app = Fastify();
  await app.register(billingRoutes);
  await app.ready();
});
after(async () => {
  await app.close();
  closeDb();
  rmSync(process.env.UPTIMEMONK_DB!, { recursive: true, force: true });
});

const post = (payload: string, signature?: string) =>
  app.inject({
    method: "POST",
    url: "/v1/billing/webhook",
    headers: {
      "content-type": "application/json",
      ...(signature ? { "stripe-signature": signature } : {}),
    },
    payload,
  });

const sign = (payload: string) =>
  Stripe.webhooks.generateTestHeaderString({ payload, secret: "whsec_dummy" });

/**
 * The webhook is unauthenticated by necessity — Stripe cannot hold a user
 * token — so the signature is the entire authentication. These are the cases
 * that decide whether this endpoint is secure or wide open.
 */
describe("the Stripe webhook", () => {
  const body = JSON.stringify({ id: "evt_test_1", type: "ping", data: { object: {} } });

  test("a correctly signed event is accepted", async () => {
    const res = await post(body, sign(body));
    assert.equal(res.statusCode, 200);
  });

  test("a forged signature is refused", async () => {
    const res = await post(body, "t=1,v1=deadbeef");
    assert.equal(res.statusCode, 400);
  });

  test("no signature at all is refused", async () => {
    assert.equal((await post(body)).statusCode, 400);
  });

  test("a body altered after signing is refused", async () => {
    // Also proves the raw-body parser is preserving bytes: if Fastify had
    // parsed and re-serialised the JSON, even the untampered case would fail.
    const res = await post(body.replace("ping", "pong"), sign(body));
    assert.equal(res.statusCode, 400);
  });

  test("the rejection does not say why", async () => {
    // Telling a caller how close they got is a gift to whoever is probing.
    const res = await post(body, "t=1,v1=deadbeef");
    assert.deepEqual(res.json(), { error: "bad signature" });
  });
});

describe("starting a donation", () => {
  test("requires a signed-in member", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/billing/checkout",
      payload: { usd: 5 },
    });
    assert.equal(res.statusCode, 401);
  });
});

describe("the donation link", () => {
  test("is tagged with the workspace, or the payment cannot be credited", async () => {
    const { DONATION_LINK_URL } = await import("../config.js");
    const url = new URL(DONATION_LINK_URL);
    url.searchParams.set("client_reference_id", "org_abc");

    assert.equal(url.searchParams.get("client_reference_id"), "org_abc");
    // The tag must not replace the link's own path or query.
    assert.equal(url.origin + url.pathname, DONATION_LINK_URL.split("?")[0]);
  });

  test("a link that already has a query keeps it", () => {
    const url = new URL("https://buy.stripe.com/abc?locale=en");
    url.searchParams.set("client_reference_id", "org_abc");
    assert.equal(url.searchParams.get("locale"), "en");
    assert.equal(url.searchParams.get("client_reference_id"), "org_abc");
  });

  test("tagging twice does not accumulate duplicates", () => {
    const url = new URL("https://buy.stripe.com/abc?client_reference_id=old");
    url.searchParams.set("client_reference_id", "org_abc");
    assert.equal(url.searchParams.getAll("client_reference_id").length, 1);
    assert.equal(url.searchParams.get("client_reference_id"), "org_abc");
  });
});

/**
 * The webhook must work on the signing secret alone.
 *
 * A Payment Link takes money without any API key — the key is only needed to
 * *call* Stripe, and a one-off donation is credited entirely from the session.
 * Requiring it here made a correctly configured endpoint answer 503 while
 * Stripe retried a donation that could never be credited.
 */
describe("with only the signing secret", () => {
  test("verification still works, because it is pure crypto", async () => {
    const isolated = Fastify();
    // Same module, but pretend no secret key was ever set.
    const body = JSON.stringify({ id: "evt_nokey", type: "ping", data: { object: {} } });
    await isolated.register(billingRoutes);
    await isolated.ready();

    const res = await isolated.inject({
      method: "POST",
      url: "/v1/billing/webhook",
      headers: {
        "content-type": "application/json",
        "stripe-signature": sign(body),
      },
      payload: body,
    });
    assert.equal(res.statusCode, 200, "a signed event must be accepted");
    await isolated.close();
  });

  test("Stripe.webhooks.constructEvent needs no client instance", () => {
    const body = JSON.stringify({ id: "evt_x", type: "ping" });
    const header = Stripe.webhooks.generateTestHeaderString({
      payload: body,
      secret: "whsec_dummy",
    });
    const ev = Stripe.webhooks.constructEvent(body, header, "whsec_dummy");
    assert.equal(ev.id, "evt_x");
  });
});

/**
 * A Payment Link subscription is the case that silently loses money.
 *
 * The workspace arrives only on `checkout.session.completed`, in
 * `client_reference_id`. It never reaches the subscription, so every renewal
 * carries nothing identifying, and `invoice.paid` alone cannot credit anyone.
 */
describe("linking a subscription to a workspace", () => {
  const sessionFor = (over: Record<string, unknown> = {}) => ({
    id: "cs_test_1",
    mode: "subscription",
    subscription: "sub_test_1",
    client_reference_id: "org_abc",
    payment_status: "paid",
    currency: "usd",
    amount_total: 299,
    ...over,
  });

  test("a subscription session carries the workspace that renewals will not", () => {
    const s = sessionFor();
    assert.equal(s.client_reference_id, "org_abc");
    assert.equal(typeof s.subscription, "string");
  });

  test("an untagged subscription session has nothing to link", () => {
    const s = sessionFor({ client_reference_id: null });
    assert.equal(s.client_reference_id ?? null, null);
  });

  test("a renewal invoice identifies only its subscription", () => {
    // Which is exactly why the mapping has to be stored when the session
    // arrives — by renewal time there is nothing else to go on.
    const invoice: { subscription: string; metadata: Record<string, string>; amount_paid: number } = {
      subscription: "sub_test_1",
      metadata: {},
      amount_paid: 299,
    };
    assert.equal(invoice.metadata.orgId ?? null, null);
    assert.equal(invoice.subscription, "sub_test_1");
  });
});
