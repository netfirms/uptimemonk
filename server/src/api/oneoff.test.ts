import { test, describe, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.UPTIMEMONK_DB = join(mkdtempSync(join(tmpdir(), "uptimemonk-oneoff-")), "t.db");
process.env.STRIPE_WEBHOOK_SECRET = "whsec_dummy";
// Deliberately no STRIPE_SECRET_KEY: a Payment Link takes money without one,
// and the whole one-off path must work on the signing secret alone.
delete process.env.STRIPE_SECRET_KEY;

const Fastify = (await import("fastify")).default;
const Stripe = (await import("stripe")).default;
const { openDb, closeDb, getDb } = await import("../db/index.js");
const repo = await import("../db/repo.js");
const { billingRoutes } = await import("./billing.js");
const { monthlyGrantCents } = await import("../lib/credits.js");

const ORG = "orgOneOff";
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
beforeEach(() => {
  getDb().prepare("DELETE FROM credit_ledger").run();
  getDb().prepare("DELETE FROM orgs").run();
  repo.upsertOrg(ORG, "Test", "free");
});

/** A one-off Payment Link purchase, as Stripe delivers it. */
function sessionEvent(over: Record<string, unknown> = {}, id = "evt_oneoff_1") {
  return JSON.stringify({
    id,
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_live_1",
        object: "checkout.session",
        mode: "payment",
        payment_status: "paid",
        currency: "usd",
        amount_total: 299,
        client_reference_id: ORG,
        subscription: null,
        ...over,
      },
    },
  });
}

const deliver = (body: string) =>
  app.inject({
    method: "POST",
    url: "/v1/billing/webhook",
    headers: {
      "content-type": "application/json",
      "stripe-signature": Stripe.webhooks.generateTestHeaderString({
        payload: body,
        secret: "whsec_dummy",
      }),
    },
    payload: body,
  });

const balance = () =>
  (getDb().prepare("SELECT credits FROM orgs WHERE id = ?").get(ORG) as any).credits;

describe("a one-off $2.99 Payment Link donation", () => {
  test("is credited, with no API key present", async () => {
    const res = await deliver(sessionEvent());
    assert.equal(res.statusCode, 200);
    assert.equal(balance(), monthlyGrantCents(299));
    assert.equal(balance(), 897_000);
  });

  test("leaves an auditable ledger entry", async () => {
    await deliver(sessionEvent());
    const [entry] = repo.creditLedger(ORG);
    assert.equal(entry.reason, "grant");
    assert.equal(entry.ref, "evt_oneoff_1");
    assert.match(String(entry.note), /2\.99/);
  });

  test("a redelivery does not grant twice", async () => {
    await deliver(sessionEvent());
    await deliver(sessionEvent());
    assert.equal(balance(), 897_000);
    assert.equal(repo.creditLedger(ORG).length, 1);
  });

  test("buying two coffees grants twice the capacity", async () => {
    // Stripe's `amount_total` already reflects quantity, so this needs no
    // special handling — but it is worth pinning, since the link shows a
    // quantity selector.
    await deliver(sessionEvent({ amount_total: 598 }, "evt_qty2"));
    assert.equal(balance(), monthlyGrantCents(598));
  });

  test("an untagged purchase credits nobody rather than guessing", async () => {
    const res = await deliver(sessionEvent({ client_reference_id: null }, "evt_untagged"));
    assert.equal(res.statusCode, 200, "must not make Stripe retry forever");
    assert.equal(balance(), 0);
  });

  test("an unpaid session grants nothing", async () => {
    await deliver(sessionEvent({ payment_status: "unpaid" }, "evt_unpaid"));
    assert.equal(balance(), 0);
  });

  test("a non-USD purchase is ignored, not treated as dollars", async () => {
    await deliver(sessionEvent({ currency: "thb", amount_total: 9900 }, "evt_thb"));
    assert.equal(balance(), 0);
  });
});
