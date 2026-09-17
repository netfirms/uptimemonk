import { readFileSync } from "node:fs";
import type { ProbeRegion } from "./types.js";
export { VERSION, API_VERSION, WORKER_VERSION } from "./version.js";

/**
 * Configuration comes from the environment or dynamic Firestore overrides.
 *
 * Fixed boot settings (PORT, REGION, WORKER_ID, GCP credentials) are supplied
 * via systemd/environment so the runtime can bootstrap.
 *
 * Operational application values (alert credentials, Stripe donation links,
 * probe concurrency, timeouts, retention, etc.) can be configured dynamically
 * from the UptimeMonke Admin console (`system/config` in Firestore).
 * Any setting not configured in Firestore falls back to its environment variable
 * or built-in default.
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

/** SQLite memory knobs. */
export const SQLITE_CACHE_KB = int("SQLITE_CACHE_KB", 16_000);
export const SQLITE_MMAP_BYTES = int("SQLITE_MMAP_BYTES", 64 * 1024 * 1024);

// ---------------------------------------------------------------------------
// Dynamic Application Configuration
// ---------------------------------------------------------------------------

export interface AppConfig {
  appUrl: string;
  apiUrl: string;
  probeConcurrency: number;
  dbFlushMs: number;
  mirrorFlushMs: number;
  mirrorMinIntervalMs: number;
  reconcileMs: number;
  retentionDays: number;
  incidentRetentionDays: number;
  userAgent: string;
  heartbeatUrl: string;

  resendApiKey: string;
  mailgunApiKey: string;
  mailgunDomain: string;
  mailgunBaseUrl: string;
  telegramBotToken: string;
  alertFromEmail: string;

  donationLinkUrl: string;
  donationLinkCents: number;
  donationLinkRecurring: boolean;
  stripeSecretKey: string;
  recaptchaSecret: string;
  recaptchaMinScore: number;
  stripeWebhookSecret: string;

  verifySecret: string;
  verifyPeerUrl: string;
}

const envDefaults: AppConfig = {
  appUrl: optional("APP_URL", "https://uptimemonke.com"),
  apiUrl: optional("API_URL", "https://api.uptimemonke.com"),
  probeConcurrency: int("PROBE_CONCURRENCY", 200),
  dbFlushMs: int("DB_FLUSH_MS", 5_000),
  mirrorFlushMs: int("MIRROR_FLUSH_MS", 5 * 60_000),
  mirrorMinIntervalMs: int("MIRROR_MIN_INTERVAL_MS", 10_000),
  reconcileMs: int("RECONCILE_MS", 15 * 60_000),
  retentionDays: int("RETENTION_DAYS", 35),
  incidentRetentionDays: int("INCIDENT_RETENTION_DAYS", 365),
  userAgent: optional("USER_AGENT", "UptimeMonke/1.0 (+https://uptimemonke.com/bot)"),
  heartbeatUrl: process.env.UPTIMEMONK_HEARTBEAT_URL ?? "",

  resendApiKey: process.env.RESEND_API_KEY ?? "",
  mailgunApiKey: process.env.MAILGUN_API_KEY ?? "",
  mailgunDomain: optional("MAILGUN_DOMAIN", "mg.uptimemonke.com"),
  mailgunBaseUrl: optional("MAILGUN_BASE_URL", "https://api.mailgun.net"),
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? "",
  alertFromEmail: optional("ALERT_FROM_EMAIL", "alerts@uptimemonke.com"),

  donationLinkUrl: optional(
    "DONATION_LINK_URL",
    "https://buy.stripe.com/9B69AU4lc2uh83Fc9Z9sk02"
  ),
  donationLinkCents: int("DONATION_LINK_CENTS", 299),
  donationLinkRecurring: process.env.DONATION_LINK_RECURRING === "true",
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",
  recaptchaSecret: process.env.RECAPTCHA_SECRET ?? "",
  // 0.5 is Google's own suggested cut. Below it is "probably a bot", not
  // "definitely" — which is why a failure here blocks a signup rather than
  // anything an existing customer does.
  recaptchaMinScore: Number(process.env.RECAPTCHA_MIN_SCORE ?? "0.5"),
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",

  verifySecret: process.env.VERIFY_SECRET ?? "",
  verifyPeerUrl: process.env.VERIFY_PEER_URL ?? "",
};

let activeOverrides: Partial<AppConfig> = {};

// Live ESM exported bindings:
export let APP_URL = envDefaults.appUrl;
export let API_URL = envDefaults.apiUrl;
export let PROBE_CONCURRENCY = envDefaults.probeConcurrency;
export let DB_FLUSH_MS = envDefaults.dbFlushMs;
export let MIRROR_FLUSH_MS = envDefaults.mirrorFlushMs;
export let MIRROR_MIN_INTERVAL_MS = envDefaults.mirrorMinIntervalMs;
export let RECONCILE_MS = envDefaults.reconcileMs;
export let RETENTION_DAYS = envDefaults.retentionDays;
export let INCIDENT_RETENTION_DAYS = envDefaults.incidentRetentionDays;
export let USER_AGENT = envDefaults.userAgent;
export let HEARTBEAT_URL = envDefaults.heartbeatUrl;

export let RESEND_API_KEY = envDefaults.resendApiKey;
export let MAILGUN_API_KEY = envDefaults.mailgunApiKey;
export let MAILGUN_DOMAIN = envDefaults.mailgunDomain;
export let MAILGUN_BASE_URL = envDefaults.mailgunBaseUrl;
export let TELEGRAM_BOT_TOKEN = envDefaults.telegramBotToken;
export let ALERT_FROM_EMAIL = envDefaults.alertFromEmail;

export let DONATION_LINK_URL = envDefaults.donationLinkUrl;
export let DONATION_LINK_CENTS = envDefaults.donationLinkCents;
export let DONATION_LINK_RECURRING = envDefaults.donationLinkRecurring;
export let STRIPE_SECRET_KEY = envDefaults.stripeSecretKey;
/**
 * Who may use the operations console. Comma-separated addresses; empty means
 * nobody, which is the safe default for a view of every customer.
 */
export const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export let RECAPTCHA_SECRET = envDefaults.recaptchaSecret;
export let RECAPTCHA_MIN_SCORE = envDefaults.recaptchaMinScore;
export let STRIPE_WEBHOOK_SECRET = envDefaults.stripeWebhookSecret;

export let VERIFY_SECRET = envDefaults.verifySecret;
export let VERIFY_PEER_URL = envDefaults.verifyPeerUrl;

/**
 * Ingests a new configuration snapshot from Firestore.
 * Updates all live variable bindings in memory immediately.
 */
export function updateDynamicConfig(data?: Record<string, unknown> | null): void {
  activeOverrides = {};
  if (data && typeof data === "object") {
    if (typeof data.appUrl === "string" && data.appUrl.trim()) {
      activeOverrides.appUrl = data.appUrl.trim();
    }
    if (typeof data.apiUrl === "string" && data.apiUrl.trim()) {
      activeOverrides.apiUrl = data.apiUrl.trim();
    }
    if (data.probeConcurrency != null && !Number.isNaN(Number(data.probeConcurrency))) {
      activeOverrides.probeConcurrency = Number(data.probeConcurrency);
    }
    if (data.dbFlushMs != null && !Number.isNaN(Number(data.dbFlushMs))) {
      activeOverrides.dbFlushMs = Number(data.dbFlushMs);
    }
    if (data.mirrorFlushMs != null && !Number.isNaN(Number(data.mirrorFlushMs))) {
      activeOverrides.mirrorFlushMs = Number(data.mirrorFlushMs);
    }
    if (data.mirrorMinIntervalMs != null && !Number.isNaN(Number(data.mirrorMinIntervalMs))) {
      activeOverrides.mirrorMinIntervalMs = Number(data.mirrorMinIntervalMs);
    }
    if (data.reconcileMs != null && !Number.isNaN(Number(data.reconcileMs))) {
      activeOverrides.reconcileMs = Number(data.reconcileMs);
    }
    if (data.retentionDays != null && !Number.isNaN(Number(data.retentionDays))) {
      activeOverrides.retentionDays = Number(data.retentionDays);
    }
    if (data.incidentRetentionDays != null && !Number.isNaN(Number(data.incidentRetentionDays))) {
      activeOverrides.incidentRetentionDays = Number(data.incidentRetentionDays);
    }
    if (typeof data.userAgent === "string" && data.userAgent.trim()) {
      activeOverrides.userAgent = data.userAgent.trim();
    }
    if (typeof data.heartbeatUrl === "string") {
      activeOverrides.heartbeatUrl = data.heartbeatUrl.trim();
    }

    if (typeof data.resendApiKey === "string") {
      activeOverrides.resendApiKey = data.resendApiKey.trim();
    }
    if (typeof data.mailgunApiKey === "string") {
      activeOverrides.mailgunApiKey = data.mailgunApiKey.trim();
    }
    if (typeof data.mailgunDomain === "string" && data.mailgunDomain.trim()) {
      activeOverrides.mailgunDomain = data.mailgunDomain.trim();
    }
    if (typeof data.mailgunBaseUrl === "string" && data.mailgunBaseUrl.trim()) {
      activeOverrides.mailgunBaseUrl = data.mailgunBaseUrl.trim();
    }
    if (typeof data.telegramBotToken === "string") {
      activeOverrides.telegramBotToken = data.telegramBotToken.trim();
    }
    if (typeof data.alertFromEmail === "string" && data.alertFromEmail.trim()) {
      activeOverrides.alertFromEmail = data.alertFromEmail.trim();
    }

    if (typeof data.donationLinkUrl === "string" && data.donationLinkUrl.trim()) {
      activeOverrides.donationLinkUrl = data.donationLinkUrl.trim();
    }
    if (data.donationLinkCents != null && !Number.isNaN(Number(data.donationLinkCents))) {
      activeOverrides.donationLinkCents = Number(data.donationLinkCents);
    }
    if (typeof data.donationLinkRecurring === "boolean") {
      activeOverrides.donationLinkRecurring = data.donationLinkRecurring;
    }
    if (typeof data.recaptchaSecret === "string") {
      activeOverrides.recaptchaSecret = data.recaptchaSecret.trim();
    }
    if (typeof data.recaptchaMinScore === "number") {
      activeOverrides.recaptchaMinScore = data.recaptchaMinScore;
    }
    if (typeof data.stripeSecretKey === "string") {
      activeOverrides.stripeSecretKey = data.stripeSecretKey.trim();
    }
    if (typeof data.stripeWebhookSecret === "string") {
      activeOverrides.stripeWebhookSecret = data.stripeWebhookSecret.trim();
    }

    if (typeof data.verifySecret === "string") {
      activeOverrides.verifySecret = data.verifySecret.trim();
    }
    if (typeof data.verifyPeerUrl === "string") {
      activeOverrides.verifyPeerUrl = data.verifyPeerUrl.trim();
    }
  }

  // Update live exported bindings
  APP_URL = activeOverrides.appUrl ?? envDefaults.appUrl;
  API_URL = activeOverrides.apiUrl ?? envDefaults.apiUrl;
  PROBE_CONCURRENCY = activeOverrides.probeConcurrency ?? envDefaults.probeConcurrency;
  DB_FLUSH_MS = activeOverrides.dbFlushMs ?? envDefaults.dbFlushMs;
  MIRROR_FLUSH_MS = activeOverrides.mirrorFlushMs ?? envDefaults.mirrorFlushMs;
  MIRROR_MIN_INTERVAL_MS = activeOverrides.mirrorMinIntervalMs ?? envDefaults.mirrorMinIntervalMs;
  RECONCILE_MS = activeOverrides.reconcileMs ?? envDefaults.reconcileMs;
  RETENTION_DAYS = activeOverrides.retentionDays ?? envDefaults.retentionDays;
  INCIDENT_RETENTION_DAYS = activeOverrides.incidentRetentionDays ?? envDefaults.incidentRetentionDays;
  USER_AGENT = activeOverrides.userAgent ?? envDefaults.userAgent;
  HEARTBEAT_URL = activeOverrides.heartbeatUrl ?? envDefaults.heartbeatUrl;

  RESEND_API_KEY = activeOverrides.resendApiKey ?? envDefaults.resendApiKey;
  MAILGUN_API_KEY = activeOverrides.mailgunApiKey ?? envDefaults.mailgunApiKey;
  MAILGUN_DOMAIN = activeOverrides.mailgunDomain ?? envDefaults.mailgunDomain;
  MAILGUN_BASE_URL = activeOverrides.mailgunBaseUrl ?? envDefaults.mailgunBaseUrl;
  TELEGRAM_BOT_TOKEN = activeOverrides.telegramBotToken ?? envDefaults.telegramBotToken;
  ALERT_FROM_EMAIL = activeOverrides.alertFromEmail ?? envDefaults.alertFromEmail;

  DONATION_LINK_URL = activeOverrides.donationLinkUrl ?? envDefaults.donationLinkUrl;
  DONATION_LINK_CENTS = activeOverrides.donationLinkCents ?? envDefaults.donationLinkCents;
  DONATION_LINK_RECURRING = activeOverrides.donationLinkRecurring ?? envDefaults.donationLinkRecurring;
  STRIPE_SECRET_KEY = activeOverrides.stripeSecretKey ?? envDefaults.stripeSecretKey;
  RECAPTCHA_SECRET = activeOverrides.recaptchaSecret ?? envDefaults.recaptchaSecret;
  RECAPTCHA_MIN_SCORE = activeOverrides.recaptchaMinScore ?? envDefaults.recaptchaMinScore;
  STRIPE_WEBHOOK_SECRET = activeOverrides.stripeWebhookSecret ?? envDefaults.stripeWebhookSecret;

  VERIFY_SECRET = activeOverrides.verifySecret ?? envDefaults.verifySecret;
  VERIFY_PEER_URL = activeOverrides.verifyPeerUrl ?? envDefaults.verifyPeerUrl;
}

/**
 * Fields that must never be written to Firestore.
 *
 * The dynamic config document is convenient for tunables and dangerous for
 * credentials: it is a second copy of a secret, in a place that is backed up,
 * replicated and readable by anything with project access — while the
 * original already sits in `/etc/uptimemonk/env` at 0600 root, which is
 * strictly better. A secret belongs in exactly one of those, and it is not
 * this one.
 *
 * Setting one through the admin console still works; it is only the *seed*
 * that refuses to copy them out of the environment.
 */
export const SECRET_CONFIG_KEYS = [
  "resendApiKey",
  "mailgunApiKey",
  "telegramBotToken",
  "stripeSecretKey",
  "stripeWebhookSecret",
  "recaptchaSecret",
  "verifySecret",
] as const;

/** The effective config minus anything secret — what is safe to seed. */
export function getSeedableConfig(): Record<string, unknown> {
  const all = getEffectiveConfig() as unknown as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(all)) {
    if ((SECRET_CONFIG_KEYS as readonly string[]).includes(k)) continue;
    out[k] = v;
  }
  return out;
}

/** Returns the effective current merged config */
export function getEffectiveConfig(): AppConfig {
  return {
    appUrl: APP_URL,
    apiUrl: API_URL,
    probeConcurrency: PROBE_CONCURRENCY,
    dbFlushMs: DB_FLUSH_MS,
    mirrorFlushMs: MIRROR_FLUSH_MS,
    mirrorMinIntervalMs: MIRROR_MIN_INTERVAL_MS,
    reconcileMs: RECONCILE_MS,
    retentionDays: RETENTION_DAYS,
    incidentRetentionDays: INCIDENT_RETENTION_DAYS,
    userAgent: USER_AGENT,
    heartbeatUrl: HEARTBEAT_URL,

    resendApiKey: RESEND_API_KEY,
    mailgunApiKey: MAILGUN_API_KEY,
    mailgunDomain: MAILGUN_DOMAIN,
    mailgunBaseUrl: MAILGUN_BASE_URL,
    telegramBotToken: TELEGRAM_BOT_TOKEN,
    alertFromEmail: ALERT_FROM_EMAIL,

    recaptchaSecret: RECAPTCHA_SECRET,
    recaptchaMinScore: RECAPTCHA_MIN_SCORE,

    donationLinkUrl: DONATION_LINK_URL,
    donationLinkCents: DONATION_LINK_CENTS,
    donationLinkRecurring: DONATION_LINK_RECURRING,
    stripeSecretKey: STRIPE_SECRET_KEY,
    stripeWebhookSecret: STRIPE_WEBHOOK_SECRET,

    verifySecret: VERIFY_SECRET,
    verifyPeerUrl: VERIFY_PEER_URL,
  };
}

/** Metadata regarding configuration origins */
export function getConfigMetadata(): Array<{
  key: keyof AppConfig;
  value: unknown;
  source: "firestore" | "env_fallback";
  fallbackValue: unknown;
}> {
  const current = getEffectiveConfig();
  return (Object.keys(envDefaults) as Array<keyof AppConfig>).map((key) => ({
    key,
    value: current[key],
    source: key in activeOverrides ? "firestore" : "env_fallback",
    fallbackValue: envDefaults[key],
  }));
}

/** Resets all dynamic overrides to original environment defaults (used in testing) */
export function resetDynamicConfig(): void {
  updateDynamicConfig(null);
}

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
