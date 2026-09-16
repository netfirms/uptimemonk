import { Timestamp } from "firebase-admin/firestore";

/** Where a probe runs from. Each region maps to its own deployed task-queue worker. */
export type ProbeRegion = "asia-southeast1" | "us-central1" | "europe-west1";

export type MonitorType =
  | "http" // plain HTTP(S) status-code check
  | "keyword" // HTTP(S) + body must (not) contain a string
  | "tcp" // TCP connect to host:port
  | "dns" // DNS record resolves / matches expected value
  | "ssl" // TLS certificate expiry
  | "heartbeat"; // cron / "push" monitor — the job calls us

export type MonitorStatus = "pending" | "up" | "down" | "paused" | "maintenance";

export interface MaintenanceWindow {
  /** ISO weekday numbers, 1 = Monday … 7 = Sunday. Empty = every day. */
  weekdays: number[];
  /** "HH:mm" in the window's timezone. */
  start: string;
  end: string;
  /** IANA timezone, e.g. "Asia/Bangkok". */
  timezone: string;
}

export interface Monitor {
  orgId: string;
  name: string;
  type: MonitorType;

  /** URL for http/keyword/ssl, hostname for tcp/dns, unused for heartbeat. */
  target: string;
  port?: number;
  method?: "GET" | "HEAD" | "POST";
  requestHeaders?: Record<string, string>;
  requestBody?: string;
  /** Status codes treated as "up". Supports ranges like "2xx". */
  acceptedStatusCodes?: string[];
  followRedirects?: boolean;

  /** keyword monitors */
  keyword?: string;
  keywordInverted?: boolean;

  /** dns monitors */
  dnsRecordType?: "A" | "AAAA" | "CNAME" | "MX" | "TXT" | "NS";
  dnsExpectedValue?: string;

  /** ssl monitors — alert when the cert expires in fewer than N days */
  sslExpiryWarningDays?: number;

  /** heartbeat monitors */
  heartbeatToken?: string;
  /** Seconds of silence before a heartbeat monitor is considered down. */
  heartbeatGraceSeconds?: number;

  /** Seconds between checks. Plan-enforced minimum. */
  intervalSeconds: number;
  timeoutSeconds: number;
  /** Consecutive failures required before we declare an incident. */
  confirmationThreshold: number;
  /** Probe regions, in priority order. First is primary; second is used to confirm failures. */
  regions: ProbeRegion[];

  enabled: boolean;
  maintenanceWindows?: MaintenanceWindow[];
  alertContactIds: string[];

  // ---- live state, written by the checker ----
  status: MonitorStatus;
  lastCheckedAt?: Timestamp;
  lastStatusChangedAt?: Timestamp;
  lastResponseTimeMs?: number;
  lastError?: string | null;
  consecutiveFailures: number;
  /** True while a maintenance window is active. Suppresses alerts, not checks. */
  inMaintenance?: boolean;
  /** Set by the dispatcher when it claims the monitor for a run. */
  nextCheckAt: Timestamp;
  /** Denormalised for list views: uptime over the trailing 24h / 7d / 30d. */
  uptime24h?: number;
  uptime7d?: number;
  uptime30d?: number;
  /** ssl/domain expiry, refreshed daily */
  certExpiresAt?: Timestamp | null;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CheckResult {
  ok: boolean;
  responseTimeMs: number;
  statusCode?: number;
  error?: string;
  /** Extra data worth persisting, e.g. resolved DNS values or cert expiry. */
  meta?: Record<string, unknown>;
  region: ProbeRegion;
  checkedAt: number; // epoch ms
}

/**
 * One document per monitor per UTC hour. Holds the raw samples for charts plus
 * pre-aggregated counters, so a 30-day chart is ~720 reads instead of ~8,640.
 */
export interface HourBucket {
  monitorId: string;
  orgId: string;
  hour: string; // "YYYYMMDDHH"
  up: number;
  down: number;
  sumMs: number;
  samples: Array<{ t: number; ms: number; ok: boolean; code?: number }>;
  expiresAt: Timestamp; // Firestore TTL field
}

export interface DayRollup {
  monitorId: string;
  orgId: string;
  day: string; // "YYYYMMDD"
  up: number;
  down: number;
  avgMs: number;
  uptimeRatio: number;
  downtimeSeconds: number;
}

export interface Incident {
  orgId: string;
  monitorId: string;
  monitorName: string;
  startedAt: Timestamp;
  resolvedAt?: Timestamp | null;
  durationSeconds?: number;
  cause: string;
  /** Regions that confirmed the failure. */
  confirmedBy: ProbeRegion[];
  status: "open" | "resolved";
  /** Set when the incident began inside a maintenance window. */
  suppressed: boolean;
  acknowledgedBy?: string | null;
}

export type AlertChannel =
  | "email"
  | "webhook"
  | "slack"
  | "discord"
  | "telegram"
  | "push";

export interface AlertContact {
  orgId: string;
  channel: AlertChannel;
  name: string;
  /** email address, webhook URL, Slack/Discord webhook URL, FCM token… */
  destination: string;
  /** telegram only */
  telegramChatId?: string;
  enabled: boolean;
  /** Alerts are only delivered to verified contacts — see alerts/verification.ts */
  verified: boolean;
  verifiedAt?: Timestamp | null;
  /** SHA-256 of the outstanding confirmation token; never the token itself. */
  verificationTokenHash?: string | null;
  verificationSentAt?: Timestamp | null;
  verificationExpiresAt?: Timestamp | null;
  createdAt: Timestamp;
}

export interface StatusPage {
  orgId: string;
  slug: string;
  customDomain?: string | null;
  title: string;
  description?: string;
  logoUrl?: string | null;
  brandColor?: string;
  monitorIds: string[];
  /** Hide response-time numbers, show only up/down. */
  showResponseTimes: boolean;
  passwordHash?: string | null;
  published: boolean;
}

export interface Org {
  name: string;
  ownerUid: string;
  plan: "free" | "solo" | "team" | "scale";
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  subscriptionStatus?: string | null;
  currentPeriodEnd?: Timestamp | null;
  createdAt: Timestamp;
}

/** Payload put on the Cloud Tasks queue for every individual check. */
export interface CheckTask {
  monitorId: string;
  /** Present when this run is a second-region confirmation of a failure. */
  verifying?: boolean;
  /** The result that triggered the verification, so we can log the cause. */
  originalError?: string;
}

export interface AlertTask {
  orgId: string;
  monitorId: string;
  incidentId: string;
  event: "down" | "up";
}
