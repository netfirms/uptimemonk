import type { FastifyInstance } from "fastify";
import Stripe from "stripe";
import { Timestamp } from "firebase-admin/firestore";
import { col } from "../sync/firebase.js";
import { requireAuth } from "./auth.js";
import { isAppleClient } from "../lib/recaptcha.js";
import { log } from "../lib/log.js";
import { getOrgCredit, postCredit, setDonationState } from "../db/repo.js";
import {
  applyGrant,
  budgetFor,
  maxMonitorsFor,
  monthlyGrant,
  monthlyGrantCents,
  standingOf,
} from "../lib/credits.js";
import {
  APP_URL,
  DONATION_LINK_CENTS,
  DONATION_LINK_RECURRING,
  DONATION_LINK_URL,
  STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET,
} from "../config.js";

/**
 * The donation link, tagged with the workspace it should credit.
 *
 * Built here rather than in the browser so the org id comes from the verified
 * token instead of from whatever the page happens to hold — a client-supplied
 * id would let anyone credit a donation to someone else's workspace, or to
 * one they had merely guessed the id of.
 */
function donationLinkFor(orgId: string): string {
  const url = new URL(DONATION_LINK_URL);
  url.searchParams.set("client_reference_id", orgId);
  return url.toString();
}

/**
 * Donations.
 *
 * Not a paywall. Every feature works on a free workspace; what a donation buys
 * is capacity, because capacity is the part that actually costs money. The
 * amount is the donor's choice rather than a tier they are pushed into.
 *
 * Stripe holds the money and the card details — nothing sensitive is stored
 * here. What comes back is a customer id, a subscription id, and an amount.
 */

const stripe = STRIPE_SECRET_KEY
  ? new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2025-02-24.acacia" as never })
  : null;

/** Suggested amounts. Any amount is accepted; these just save a decision. */
const SUGGESTED_USD = [3, 5, 10, 25];
const MIN_USD = 1;
const MAX_USD = 500;

/**
 * What a client is told about paying, if anything.
 *
 * Exported so the App Store constraint has a test rather than only a code
 * review: an iOS build shown a payment path outside In-App Purchase fails
 * review under Guideline 3.1.1, and this is the single place that decides.
 *
 * Returns an empty object for Apple clients — not a block with nulls in it.
 * A key present and empty is something a client can still render badly.
 */
export function fundingBlock(
  appleClient: boolean,
  orgId: string,
  stripeConfigured: boolean
): Record<string, unknown> {
  if (appleClient) return {};
  return {
    suggestedUsd: SUGGESTED_USD,

    /**
     * The one-click option. Available whether or not a secret key is set:
     * taking money through a Payment Link needs no API key at all, only the
     * webhook secret to *record* it. Those are separate concerns and the UI
     * reports them separately.
     */
    link: {
      url: donationLinkFor(orgId),
      cents: DONATION_LINK_CENTS,
      checks: monthlyGrantCents(DONATION_LINK_CENTS),
      recurring: DONATION_LINK_RECURRING,
      /** False means a donation would be taken but never credited. */
      credited: Boolean(STRIPE_WEBHOOK_SECRET),
    },

    // Custom amounts need the API key, since they create a session.
    enabled: stripeConfigured,
    preview: SUGGESTED_USD.map((usd) => ({ usd, checks: monthlyGrant(usd) })),
  };
}

export async function billingRoutes(app: FastifyInstance): Promise<void> {
  // The webhook lives in its own plugin scope so its raw-body parser applies
  // only to it. Fastify content-type parsers are per-encapsulation-context;
  // registering one at this level would also hit /checkout, which wants the
  // body parsed normally.
  await app.register(webhookRoute);

  /**
   * What this workspace is running on, and what it would get for a donation.
   *
   * Deliberately readable by any member, not just the owner: "why can I not
   * add another monitor" is a question everyone in a workspace can hit.
   */
  app.get("/v1/billing", { preHandler: requireAuth() }, async (req) => {
    const credit = getOrgCredit(req.user!.orgId);

    /**
     * The iOS build is told its balance and never how to add to it.
     *
     * App Store Guideline 3.1.1 forbids steering users to a payment method
     * outside In-App Purchase, and a Stripe URL in an API response is exactly
     * that even when no button currently renders it. Withholding it here
     * rather than only hiding the UI means a future screen cannot surface it
     * by accident — the app is never given the link to show.
     *
     * Standing, balance and budget stay: they are what the workspace *has*,
     * which the app needs to explain why a monitor was refused, and are not
     * an offer to sell anything.
     */
    const appleClient = isAppleClient(req.headers["x-platform"]);
    const funding = fundingBlock(appleClient, req.user!.orgId, Boolean(stripe));

    return {
      standing: standingOf(credit),
      credits: credit.credits,
      donationUsdMonthly: credit.donationUsdMonthly,
      graceUntil: credit.graceUntil,
      checksPerDayBudget: budgetFor(credit),
      maxMonitors: maxMonitorsFor(credit),
      /** Lets a client render an explanation instead of an empty panel. */
      fundingAvailable: !appleClient,
      ...funding,
    };
  });

  /**
   * Start a donation.
   *
   * A subscription rather than a one-off, because capacity is a recurring cost
   * and a recurring gift is what lets the budget be granted each cycle. The
   * price is created inline from the chosen amount — no dashboard-configured
   * price ids to drift out of sync with the code.
   */
  app.post<{ Body: { usd?: number } }>(
    "/v1/billing/checkout",
    { preHandler: requireAuth() },
    async (req, reply) => {
      // Refused for the iOS build as well as hidden from it. The app has no
      // screen that calls this, and that is exactly why the check belongs
      // here: a route reachable only by accident is the one that gets reached
      // by accident, and a payment path outside In-App Purchase is what App
      // Store review rejects.
      if (isAppleClient(req.headers["x-platform"])) {
        return reply.code(404).send({ error: "Not available." });
      }

      if (!stripe) {
        return reply.code(503).send({ error: "Donations are not configured on this server" });
      }

      const usd = Math.round(Number(req.body?.usd));
      if (!Number.isFinite(usd) || usd < MIN_USD || usd > MAX_USD) {
        return reply
          .code(400)
          .send({ error: `Choose an amount between $${MIN_USD} and $${MAX_USD} a month` });
      }

      const { orgId, uid } = req.user!;
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        // The org id is the only thing tying the payment back to a workspace.
        // It goes on the subscription too, because the webhook that matters
        // most (`invoice.paid`) sees the subscription, not this session.
        client_reference_id: orgId,
        metadata: { orgId, uid },
        subscription_data: { metadata: { orgId, uid } },
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "usd",
              recurring: { interval: "month" },
              unit_amount: usd * 100,
              product_data: {
                name: "UptimeMonke — monthly support",
                description: `Adds ${monthlyGrant(usd).toLocaleString()} checks of monitoring capacity each month.`,
              },
            },
          },
        ],
        success_url: `${APP_URL}/dashboard?donated=1`,
        cancel_url: `${APP_URL}/dashboard`,
      });

      log.info({ orgId, usd }, "donation checkout started");
      return { url: session.url };
    }
  );

  /* the webhook is registered above, in its own scope */
}

async function webhookRoute(app: FastifyInstance): Promise<void> {
  // Keep the bytes exactly as Stripe sent them. Re-serialising parsed JSON
  // changes whitespace and key order, the signature stops matching, and this
  // endpoint ends up either permanently broken or quietly waved through.
  app.addContentTypeParser(
    "application/json",
    { parseAs: "buffer" },
    (_req, body, done) => done(null, body)
  );

  /**
   * Stripe's callback.
   *
   * Unauthenticated by necessity — Stripe cannot hold a user token — so the
   * signature is the entire authentication. It is verified against the *raw*
   * body: re-serialising parsed JSON changes the bytes and the signature stops
   * matching, which is the classic way this endpoint ends up either broken or
   * accidentally open. The raw body is captured by the content-type parser
   * registered below.
   */
  app.post("/v1/billing/webhook", async (req, reply) => {
    // Only the signing secret is required. Verification is pure crypto —
    // `Stripe.webhooks` is a static, no API key involved — and a Payment Link
    // donation is fully credited from the session alone. Demanding a secret
    // key here meant a correctly configured webhook answered 503, Stripe
    // retried until it gave up, and the donation was never credited.
    if (!STRIPE_WEBHOOK_SECRET) {
      return reply.code(503).send({ error: "not configured" });
    }

    const signature = req.headers["stripe-signature"];
    if (typeof signature !== "string") {
      return reply.code(400).send({ error: "missing signature" });
    }

    let event: Stripe.Event;
    try {
      event = Stripe.webhooks.constructEvent(
        req.body as Buffer,
        signature,
        STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      // Never echo the reason: it tells an attacker how close they got.
      log.warn({ err }, "rejected a webhook with a bad signature");
      return reply.code(400).send({ error: "bad signature" });
    }

    try {
      await handle(event);
    } catch (err) {
      // 500 so Stripe retries. Swallowing it would lose a donation silently.
      log.error({ err, type: event.type, id: event.id }, "webhook handling failed");
      return reply.code(500).send({ error: "handler failed" });
    }

    return { received: true };
  });
}

/**
 * Apply an event.
 *
 * Only two things matter: money actually arrived, or the donation stopped.
 * Everything else Stripe sends is noise for this purpose.
 */
async function handle(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    /**
     * A completed Checkout — including a one-off Payment Link.
     *
     * A one-time payment never produces an invoice, so `invoice.paid` alone
     * silently grants nothing for a "buy me a coffee" link. Subscriptions are
     * skipped here and granted from `invoice.paid` instead, so the first cycle
     * is not counted twice.
     *
     * A Payment Link carries no org id of its own: it has to be appended to
     * the URL as `?client_reference_id=<orgId>`. Without it there is nothing
     * tying the payment to a workspace, so the donation is logged and left for
     * a human rather than guessed at.
     */
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const orgId = session.client_reference_id ?? session.metadata?.orgId;

      /**
       * A subscription's first payment is granted by `invoice.paid`, not here,
       * or the first month would be credited twice. But the workspace only
       * exists on *this* event: a Payment Link carries it in
       * `client_reference_id`, and it never reaches the subscription, so every
       * renewal would arrive with nobody to credit. Record the mapping and let
       * the invoice do the granting.
       */
      if (session.mode === "subscription") {
        const subId =
          typeof session.subscription === "string" ? session.subscription : null;
        if (subId && orgId) {
          await col.stripeSubs().doc(subId).set({ orgId, at: Timestamp.now() });
          log.info({ orgId, subId }, "subscription linked to workspace");
        } else {
          log.warn(
            { subId, sessionId: session.id },
            "subscription with no workspace attached — append ?client_reference_id=<orgId> to the payment link"
          );
        }
        return;
      }

      if (session.payment_status !== "paid") return;

      if (!orgId) {
        log.warn(
          { sessionId: session.id, amount: session.amount_total },
          "donation with no workspace attached — append ?client_reference_id=<orgId> to the payment link"
        );
        return;
      }

      if ((session.currency ?? "usd").toLowerCase() !== "usd") {
        log.warn({ orgId, currency: session.currency }, "ignoring non-USD donation");
        return;
      }

      const cents = session.amount_total ?? 0;
      if (cents <= 0) return;

      const grant = monthlyGrantCents(cents);
      const posted = postCredit({
        orgId,
        delta: grant,
        reason: "grant",
        ref: event.id,
        note: `one-off $${(cents / 100).toFixed(2)}`,
      });
      if (!posted) {
        log.info({ orgId, eventId: event.id }, "duplicate delivery ignored");
        return;
      }

      // A one-off buys a block of capacity, it does not set a recurring
      // amount — so `donationUsdMonthly` is deliberately left alone. Any grace
      // window is cleared: they have just paid.
      setDonationState(orgId, { graceUntil: null });
      log.info({ orgId, cents, granted: grant, balance: posted.balance }, "one-off donation applied");
      return;
    }

    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      const orgId = await orgIdFor(invoice);

      if (!orgId) {
        // Stripe does not guarantee event order, so `invoice.paid` can beat
        // the `checkout.session.completed` that carries the workspace. Failing
        // loudly makes Stripe retry, by which time the mapping exists —
        // returning 200 here would drop a real payment on the floor.
        const subId =
          typeof invoice.subscription === "string" ? invoice.subscription : null;
        if (subId) {
          throw new Error(`no workspace linked to subscription ${subId} yet — will retry`);
        }
        return;
      }

      // Only dollars. Stripe will happily settle an invoice in any currency
      // the account accepts, and treating 500 JPY as $500 of capacity would be
      // a 75x giveaway.
      if ((invoice.currency ?? "usd").toLowerCase() !== "usd") {
        log.warn({ orgId, currency: invoice.currency }, "ignoring non-USD invoice");
        return;
      }

      // `amount_paid` is what actually cleared, not what was asked for. A
      // discounted or partly-paid invoice grants what it was worth.
      // Cents, not rounded dollars — a $0.99 donation is not $1, and a $0.49
      // one is not zero.
      const cents = invoice.amount_paid ?? 0;
      if (cents <= 0) return;

      const before = getOrgCredit(orgId);
      const after = applyGrant(before, cents);

      // The ledger's unique (reason, ref) is the idempotency guarantee. A
      // replayed delivery posts nothing and returns null.
      const posted = postCredit({
        orgId,
        delta: after.credits - before.credits,
        reason: "grant",
        ref: event.id,
        note: `$${(cents / 100).toFixed(2)}`,
      });
      if (!posted) {
        log.info({ orgId, eventId: event.id }, "duplicate delivery ignored");
        return;
      }

      // Coming back clears any grace window — being back is just being back.
      setDonationState(orgId, { donationUsdMonthly: cents / 100, graceUntil: null });
      log.info({ orgId, cents, balance: posted.balance }, "donation applied");
      return;
    }

    /**
     * Money went back. Take the capacity back with it.
     *
     * Without this, refunding a donation leaves the credit in place — the
     * customer keeps what they were given and has the money too. `charge.
     * refunded` covers a voluntary refund; a dispute is handled the same way
     * because the funds are withdrawn either way.
     */
    case "charge.refunded":
    case "charge.dispute.created": {
      const charge =
        event.type === "charge.refunded"
          ? (event.data.object as Stripe.Charge)
          : ((event.data.object as Stripe.Dispute).charge as Stripe.Charge | string);

      const resolved = typeof charge === "string" ? await chargeById(charge) : charge;
      if (!resolved) return;

      const orgId = await orgIdForCharge(resolved);
      if (!orgId) return;

      const usd = Math.round(
        (event.type === "charge.refunded"
          ? (resolved.amount_refunded ?? 0)
          : ((event.data.object as Stripe.Dispute).amount ?? 0)) / 100
      );
      if (usd <= 0) return;

      const posted = postCredit({
        orgId,
        delta: -monthlyGrant(usd),
        reason: event.type === "charge.refunded" ? "refund" : "dispute",
        ref: event.id,
        note: `$${usd} returned`,
      });
      if (posted) {
        log.warn(
          { orgId, usd, balance: posted.balance, type: event.type },
          "capacity clawed back"
        );
      }
      return;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const orgId = sub.metadata?.orgId;
      if (!orgId) return;

      // Credit already granted is kept — it was given in good faith and paid
      // for. Only the recurring top-up stops.
      setDonationState(orgId, { donationUsdMonthly: 0 });
      log.info({ orgId }, "donation cancelled — existing credit retained");
      return;
    }

    default:
      return;
  }
}

async function chargeById(id: string): Promise<Stripe.Charge | null> {
  if (!stripe) return null;
  try {
    return await stripe.charges.retrieve(id);
  } catch {
    return null;
  }
}

/** The org behind a charge, via its invoice's subscription metadata. */
async function orgIdForCharge(charge: Stripe.Charge): Promise<string | null> {
  const direct = charge.metadata?.orgId;
  if (direct) return direct;
  if (!stripe) return null;

  const invoiceId = typeof charge.invoice === "string" ? charge.invoice : null;
  if (!invoiceId) return null;
  return orgIdFor(await stripe.invoices.retrieve(invoiceId));
}

/** The org behind an invoice, from the subscription's metadata. */
/**
 * The workspace behind an invoice.
 *
 * Three sources, cheapest first. The stored mapping is what makes a Payment
 * Link subscription work at all, and it needs no API key — which matters,
 * because taking money through a link never required one.
 */
async function orgIdFor(invoice: Stripe.Invoice): Promise<string | null> {
  const direct = invoice.metadata?.orgId;
  if (direct) return direct;

  const subId = typeof invoice.subscription === "string" ? invoice.subscription : null;
  if (!subId) return null;

  const linked = await col.stripeSubs().doc(subId).get();
  const mapped = linked.data()?.orgId;
  if (typeof mapped === "string" && mapped) return mapped;

  // A session we created ourselves puts the org on the subscription's own
  // metadata, but reading it back needs the API key.
  if (!stripe) return null;
  const sub = await stripe.subscriptions.retrieve(subId);
  return sub.metadata?.orgId ?? null;
}
