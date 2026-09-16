/**
 * UptimeMonk — Cloud Functions entry point.
 *
 * Deployed surface:
 *   dispatchChecks   scheduler  every minute, claims due monitors, fans out
 *   runCheckAsia     tasks      probe worker, asia-southeast1
 *   runCheckUs       tasks      probe worker, us-central1
 *   runCheckEu       tasks      probe worker, europe-west1
 *   sendAlerts       tasks      alert fan-out (email/slack/discord/telegram/webhook)
 *   rollupDaily      scheduler  00:15 UTC, hour buckets -> day rollups
 *   heartbeat        https      cron-job ping ingest
 *   verifyContact    https      alert-contact confirmation link target
 *   createMonitor / updateMonitor / sendContactVerification   callable
 *   api              https      public REST API v1
 *   stripeWebhook    https      subscription sync
 *   createCheckoutSession / createPortalSession / createApiKey / inviteMember  callable
 *   bootstrapUser    auth       creates org + claims on signup
 *
 * Cost shape: ONE Cloud Scheduler job ($0.10/mo) drives the whole fleet.
 */
import "./config";
import { makeWorker } from "./monitors/worker";

export { dispatchChecks } from "./scheduler/dispatcher";
export { rollupDaily } from "./scheduler/rollup";
export { sendAlerts } from "./alerts/dispatch";
export { heartbeat } from "./api/heartbeat";
export { api } from "./api/v1";
export {
  createCheckoutSession,
  createPortalSession,
  stripeWebhook,
} from "./billing/stripe";
export { bootstrapUser, createApiKey, inviteMember } from "./monitors/onboarding";
export { createMonitor, updateMonitor } from "./monitors/crud";
export { sendContactVerification, verifyContact } from "./alerts/verification";

// One probe worker per region. The names must match QUEUE_NAME in config.ts.
export const runCheckAsia = makeWorker("asia-southeast1");
export const runCheckUs = makeWorker("us-central1");
export const runCheckEu = makeWorker("europe-west1");
