import { readFileSync } from "node:fs";
import type { ProbeRegion } from "./types.js";
export { VERSION, API_VERSION, WORKER_VERSION } from "./version.js";

/**
 * Configuration comes from the environment, which systemd populates from a
 * root-owned EnvironmentFile. Nothing here has a secret as a default, and the
 * process refuses to start rather than run half-configured — a monitoring
 * service that boots without its alert credentials is worse than one that
 * doesn't boot at all, because it looks healthy.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. See deploy/uptimemonk.env.example`
    );
  }
  return value;
}

function optional(name: string, fallback: string): string {
  return process.env[name] || fallback;
}

function int(name: string, fallback: number): number {
  const raw = process.env[name];
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Worker identity.
 *
 * A "worker" is one Lightsail instance. Scaling the system out means running
 * more of them, so each needs to know which slice of the fleet it owns —
 * decided locally from a stable hash, with no coordination between workers.
 */

/** Probe vantage point. Monitors whose home region matches are probed here. */
export const REGION = optional("UPTIMEMONK_REGION", "ap-southeast-1") as ProbeRegion;

/** Human-readable name for logs and peer verification, e.g. "sg-1". */
export const WORKER_ID = optional("UPTIMEMONK_WORKER_ID", `${REGION}-0`);

/** 0-based position of this worker within its region's pool. */
export const WORKER_INDEX = int("UPTIMEMONK_WORKER_INDEX", 0);

/**
 * How many workers serve this region. Every worker in the pool must agree on
 * this number — if they disagree, some organisations are probed twice and
 * others not at all.
 */
export const WORKER_COUNT = Math.max(1, int("UPTIMEMONK_WORKER_COUNT", 1));

if (WORKER_INDEX < 0 || WORKER_INDEX >= WORKER_COUNT) {
  throw new Error(
    `UPTIMEMONK_WORKER_INDEX (${WORKER_INDEX}) must be between 0 and ` +
      `UPTIMEMONK_WORKER_COUNT - 1 (${WORKER_COUNT - 1}). ` +
      `A worker outside its own pool would probe nothing.`
  );
}

export const DB_PATH = optional("UPTIMEMONK_DB", "/var/lib/uptimemonk/uptimemonk.db");

export const PORT = int("PORT", 8080);

export const APP_URL = optional("APP_URL", "https://uptimemonke.com");
export const API_URL = optional("API_URL", "https://api.uptimemonke.com");

// ---- probe tuning ----
/** Concurrent in-flight probes. Guards file descriptors and memory, not CPU. */
export const PROBE_CONCURRENCY = int("PROBE_CONCURRENCY", 200);
/** How often buffered check results are flushed to SQLite, in one transaction. */
export const DB_FLUSH_MS = int("DB_FLUSH_MS", 5_000);
/** How often the aggregated status mirror is pushed to Firestore. */
export const MIRROR_FLUSH_MS = int("MIRROR_FLUSH_MS", 5 * 60_000);
/** A state change flushes immediately, but never more often than this per org. */
export const MIRROR_MIN_INTERVAL_MS = int("MIRROR_MIN_INTERVAL_MS", 10_000);
/** Full reconcile against Firestore, in case a listener dies without erroring. */
export const RECONCILE_MS = int("RECONCILE_MS", 15 * 60_000);
/** Raw hourly samples are deleted after this many days. */
export const RETENTION_DAYS = int("RETENTION_DAYS", 35);
/**
 * Resolved incidents are kept much longer than raw samples — they are what a
 * customer refers back to — but not forever. Open incidents are never pruned.
 */
export const INCIDENT_RETENTION_DAYS = int("INCIDENT_RETENTION_DAYS", 365);

/**
 * SQLite memory knobs. Defaults suit a 1 GB instance; the 512 MB plan wants
 * roughly a quarter of each, which provision.sh sets automatically.
 */
export const SQLITE_CACHE_KB = int("SQLITE_CACHE_KB", 16_000);
export const SQLITE_MMAP_BYTES = int("SQLITE_MMAP_BYTES", 64 * 1024 * 1024);

export const USER_AGENT = optional(
  "USER_AGENT",
  "UptimeMonke/1.0 (+https://uptimemonke.com/bot)"
);

// ---- secrets ----
export const RESEND_API_KEY = process.env.RESEND_API_KEY ?? "";

/**
 * Mailgun, the preferred email transport when configured.
 *
 * Two providers rather than one because email is the channel that matters
 * most and the one most likely to be mid-migration. `sendEmail` picks Mailgun
 * when it has a key and falls back to Resend, so swapping providers is an env
 * change and a restart, not a deploy.
 *
 * The domain is the *sending* domain registered with Mailgun — usually a
 * subdomain like `mg.example.com`, not the bare apex.
 */
/**
 * Stripe, for donations.
 *
 * Inert until both are set, like the email providers — the routes register but
 * refuse, so a worker without keys starts cleanly instead of crashing.
 * `STRIPE_WEBHOOK_SECRET` is not optional when the webhook is reachable: it is
 * the only thing distinguishing Stripe from anyone who knows the URL.
 */
/**
 * A pre-made Stripe Payment Link, used instead of creating a Checkout Session
 * per donation.
 *
 * Simpler to operate — no secret key needed just to take money — but the link
 * carries no workspace id of its own, so `?client_reference_id=<orgId>` is
 * appended before it is handed to the browser. Without that the webhook has
 * nothing tying the payment to an account.
 */
export const DONATION_LINK_URL = optional(
  "DONATION_LINK_URL",
  "https://buy.stripe.com/9B69AU4lc2uh83Fc9Z9sk02"
);
/**
 * What that link charges, in cents — for the button label and the preview.
 *
 * Must match the Payment Link. It is only used for display: the grant itself
 * comes from what Stripe says was actually paid, so a mismatch misleads the
 * button rather than mis-crediting the donor.
 */
export const DONATION_LINK_CENTS = int("DONATION_LINK_CENTS", 299);

/** The link is a monthly subscription, not a one-off — it changes the copy. */
export const DONATION_LINK_RECURRING =
  (process.env.DONATION_LINK_RECURRING ?? "true") !== "false";

export const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY ?? "";
export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "";

export const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY ?? "";
export const MAILGUN_DOMAIN = optional("MAILGUN_DOMAIN", "mg.uptimemonke.com");
/** `https://api.eu.mailgun.net` for an EU-region account. */
export const MAILGUN_BASE_URL = optional("MAILGUN_BASE_URL", "https://api.mailgun.net");
export const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
export const ALERT_FROM_EMAIL = optional("ALERT_FROM_EMAIL", "alerts@uptimemonke.com");

/**
 * Shared secret for the cross-region verify call. The second box exposes
 * /internal/verify and signs nothing else; without this, anyone who finds the
 * endpoint can make us probe arbitrary hosts on their behalf.
 */
export const VERIFY_SECRET = process.env.VERIFY_SECRET ?? "";
/** Base URL of the peer box that confirms failures, if there is one. */
export const VERIFY_PEER_URL = process.env.VERIFY_PEER_URL ?? "";

/** External dead-man's switch. The worker pings this every tick. */
export const HEARTBEAT_URL = process.env.UPTIMEMONK_HEARTBEAT_URL ?? "";

/**
 * GCP credentials. systemd's LoadCredential puts the key in a directory it
 * owns and exports CREDENTIALS_DIRECTORY; fall back to the standard variable
 * so local development works without systemd.
 */
export function googleCredentials(): { projectId: string; credential?: object } {
  const projectId = required("GOOGLE_CLOUD_PROJECT");
  const credDir = process.env.CREDENTIALS_DIRECTORY;
  const path = credDir
    ? `${credDir}/gcp-sa`
    : process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (!path) return { projectId };
  return { projectId, credential: JSON.parse(readFileSync(path, "utf8")) };
}
