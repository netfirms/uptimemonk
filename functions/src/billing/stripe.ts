import { onRequest, onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { Timestamp } from "firebase-admin/firestore";
import Stripe from "stripe";
import { col } from "../lib/firestore";
import {
  APP_URL,
  PRIMARY_REGION,
  STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET,
} from "../config";
import type { Org } from "../types";

/**
 * Billing is wired directly to Stripe rather than through the Firebase Stripe
 * extension on purpose: Firebase Extensions management shuts down on
 * 2027-03-31, so anything built on an installed extension needs migrating
 * within the year. This is ~120 lines and you own it.
 *
 * Map Stripe price IDs to plans here.
 */
const PRICE_TO_PLAN: Record<string, Org["plan"]> = {
  // "price_1AbCdEf...": "solo",
  // "price_1GhIjKl...": "team",
  // "price_1MnOpQr...": "scale",
};

function stripeClient(): Stripe {
  return new Stripe(STRIPE_SECRET_KEY.value(), { apiVersion: "2025-02-24.acacia" });
}

/** Called from the dashboard "Upgrade" button. */
export const createCheckoutSession = onCall(
  { region: PRIMARY_REGION, secrets: [STRIPE_SECRET_KEY] },
  async (req) => {
    if (!req.auth) throw new HttpsError("unauthenticated", "Sign in first");
    const { orgId, priceId } = req.data as { orgId: string; priceId: string };

    const orgRef = col.orgs().doc(orgId);
    const orgSnap = await orgRef.get();
    const org = orgSnap.data() as Org | undefined;
    if (!org) throw new HttpsError("not-found", "Organisation not found");
    if (org.ownerUid !== req.auth.uid) {
      throw new HttpsError("permission-denied", "Only the owner can change billing");
    }

    const stripe = stripeClient();
    let customerId = org.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: req.auth.token.email ?? undefined,
        metadata: { orgId, uid: req.auth.uid },
      });
      customerId = customer.id;
      await orgRef.update({ stripeCustomerId: customerId });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${APP_URL.value()}/settings/billing?status=success`,
      cancel_url: `${APP_URL.value()}/settings/billing?status=cancelled`,
      client_reference_id: orgId,
      subscription_data: { metadata: { orgId } },
    });

    return { url: session.url };
  }
);

/** Stripe customer portal, so you never build a billing UI. */
export const createPortalSession = onCall(
  { region: PRIMARY_REGION, secrets: [STRIPE_SECRET_KEY] },
  async (req) => {
    if (!req.auth) throw new HttpsError("unauthenticated", "Sign in first");
    const { orgId } = req.data as { orgId: string };
    const org = (await col.orgs().doc(orgId).get()).data() as Org | undefined;
    if (!org?.stripeCustomerId) {
      throw new HttpsError("failed-precondition", "No Stripe customer for this org");
    }
    const session = await stripeClient().billingPortal.sessions.create({
      customer: org.stripeCustomerId,
      return_url: `${APP_URL.value()}/settings/billing`,
    });
    return { url: session.url };
  }
);

/**
 * Webhook. Firebase gives you the raw body on `req.rawBody`, which is exactly
 * what Stripe's signature check needs — do not use req.body here.
 */
export const stripeWebhook = onRequest(
  {
    region: PRIMARY_REGION,
    secrets: [STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET],
    memory: "256MiB",
  },
  async (req, res) => {
    const stripe = stripeClient();
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        req.rawBody,
        req.get("stripe-signature") ?? "",
        STRIPE_WEBHOOK_SECRET.value()
      );
    } catch (err) {
      logger.error("stripe webhook signature failed", err);
      res.status(400).send(`Signature verification failed`);
      return;
    }

    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const orgId = sub.metadata?.orgId;
        if (!orgId) break;

        const priceId = sub.items.data[0]?.price.id ?? "";
        const active = sub.status === "active" || sub.status === "trialing";
        await col.orgs().doc(orgId).update({
          plan: active ? (PRICE_TO_PLAN[priceId] ?? "free") : "free",
          stripeSubscriptionId: sub.id,
          subscriptionStatus: sub.status,
          currentPeriodEnd: Timestamp.fromMillis(
            (sub as unknown as { current_period_end: number }).current_period_end * 1000
          ),
        });
        logger.info("subscription synced", { orgId, status: sub.status });
        break;
      }
      default:
        break;
    }

    res.json({ received: true });
  }
);
