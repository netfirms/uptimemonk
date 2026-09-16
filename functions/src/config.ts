import { setGlobalOptions } from "firebase-functions/v2";
import { defineSecret, defineString } from "firebase-functions/params";
import type { ProbeRegion } from "./types";

/**
 * Pick the region closest to you / your users. Firestore's location is
 * PERMANENT once chosen, so decide this before you create the database.
 * asia-southeast1 (Singapore) is the low-latency choice from Thailand.
 */
export const PRIMARY_REGION: ProbeRegion = "asia-southeast1";

/** Regions we deploy probe workers into. Add one, redeploy, done. */
export const PROBE_REGIONS: ProbeRegion[] = [
  "asia-southeast1",
  "us-central1",
  "europe-west1",
];

/** Task-queue function name per region. Must match the exports in index.ts. */
export const QUEUE_NAME: Record<ProbeRegion, string> = {
  "asia-southeast1": "runCheckAsia",
  "us-central1": "runCheckUs",
  "europe-west1": "runCheckEu",
};

setGlobalOptions({
  region: PRIMARY_REGION,
  memory: "256MiB",
  maxInstances: 20,
});

// ---- secrets (set with: firebase functions:secrets:set NAME) ----
export const RESEND_API_KEY = defineSecret("RESEND_API_KEY");
export const STRIPE_SECRET_KEY = defineSecret("STRIPE_SECRET_KEY");
export const STRIPE_WEBHOOK_SECRET = defineSecret("STRIPE_WEBHOOK_SECRET");
export const TELEGRAM_BOT_TOKEN = defineSecret("TELEGRAM_BOT_TOKEN");

// ---- plain config ----
export const APP_URL = defineString("APP_URL", {
  default: "https://uptimemonke.com",
});
export const ALERT_FROM_EMAIL = defineString("ALERT_FROM_EMAIL", {
  default: "alerts@uptimemonke.com",
});
/** Base URL of the deployed functions, used to build confirmation links. */
export const FUNCTIONS_BASE_URL = defineString("FUNCTIONS_BASE_URL", {
  default: `https://${PRIMARY_REGION}-uptimemonk.cloudfunctions.net`,
});

/** Ceiling on API keys per organisation — they are credentials, not config. */
export const MAX_API_KEYS_PER_ORG = 10;

/** How long raw per-check samples are kept before Firestore TTL deletes them. */
export const RAW_SAMPLE_RETENTION_DAYS = 35;

/**
 * Monitors claimed per page. 500 is Firestore's batched-write ceiling, so this
 * is the largest a single claim commit can be — the tick pages instead.
 */
export const DISPATCH_BATCH_SIZE = 500;
/** Pages per tick: 20 x 500 = 10,000 checks a minute before work is deferred. */
export const MAX_PAGES_PER_TICK = 20;
/** Stop claiming after this long so the tick still has time to enqueue. */
export const MAX_CLAIM_MS = 45_000;

export const USER_AGENT =
  "UptimeMonk/1.0 (+https://uptimemonke.com/bot) Mozilla/5.0 (compatible)";
