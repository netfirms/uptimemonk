/**
 * Server-side domain types.
 *
 * Deliberately free of firebase-admin's `Timestamp`: on a worker every instant
 * is epoch milliseconds, which is what SQLite stores and what `Date.now()`
 * returns. Conversion to and from Firestore Timestamps happens only at the
 * sync boundary, in sync/mirror.ts.
 */

export type ProbeRegion = "ap-southeast-1" | "us-east-1" | "eu-west-1";

export type MonitorType =
  | "http" // plain HTTP(S) status-code check
  | "keyword" // HTTP(S) + body must (not) contain a string
  | "tcp" // TCP connect to host:port
  | "dns" // DNS record resolves / matches expected value
  | "ssl" // TLS certificate expiry
  | "icmp" // real ping — possible here, unlike on Cloud Functions
  | "heartbeat"; // cron / "push" monitor — the job calls us

export type MonitorStatus = "pending" | "up" | "down" | "paused";

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
  id: string;
  orgId: string;
  name: string;
  type: MonitorType;

  /** URL for http/keyword/ssl, hostname for tcp/dns/icmp, unused for heartbeat. */
  target: string;
  port?: number;
  method?: "GET" | "HEAD" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS";
  requestHeaders?: Record<string, string>;
  requestBody?: string;
  acceptedStatusCodes?: string[];
  followRedirects?: boolean;
  maxResponseTimeMs?: number;
  httpAuthType?: "none" | "basic" | "bearer";
  authUsername?: string;
  authPassword?: string;
  authToken?: string;

  keyword?: string;
  keywordInverted?: boolean;
  /** Default false: matching ignores case, which is what people expect. */
  keywordCaseSensitive?: boolean;
  keywordRegex?: boolean;
  jsonPath?: string;
  jsonPathExpected?: string;

  dnsRecordType?: "A" | "AAAA" | "CNAME" | "MX" | "TXT" | "NS" | "CAA" | "SOA" | "PTR" | "SRV";
  dnsExpectedValue?: string;
  dnsServer?: string;

  /**
   * Days before expiry at which to warn, highest first — e.g. [30, 14, 7, 1].
   * Each fires once for a given certificate; a renewal resets them.
   */
  sslExpiryAlertDays?: number[];
  /** @deprecated Single threshold. Read as a one-element `sslExpiryAlertDays`
   *  so monitors created before this keep working. */
  sslExpiryWarningDays?: number;
  sslExpectedFingerprint?: string;
  sslMinVersion?: "TLSv1.2" | "TLSv1.3";

  tcpPayload?: string;
  tcpExpectedResponse?: string;

  icmpPacketCount?: number;
  icmpMaxLossPercent?: number;

  heartbeatToken?: string;
  heartbeatGraceSeconds?: number;

  intervalSeconds: number;
  timeoutSeconds: number;
  confirmationThreshold: number;
  /** Home region first; a second entry is asked to confirm failures. */
  regions: ProbeRegion[];

  enabled: boolean;
  /**
   * Show this monitor on the org's public status page.
   *
   * Opt-in, not opt-out: a monitor's existence and name become public, and
   * defaulting that on would publish internal service names the first time
   * anyone opened a status page.
   */
  publicOnStatusPage?: boolean;
  maintenanceWindows?: MaintenanceWindow[];
  /**
   * Who to tell. **Empty means every verified contact in the org**, not
   * nobody — see `queueAlerts`. Deliberate silence is `muteAlerts`.
   */
  alertContactIds: string[];
  /** Record incidents but page no one. Explicit, and shown in the UI. */
  muteAlerts?: boolean;

  // ---- live state, owned by the worker ----
  status: MonitorStatus;
  lastCheckedAt?: number;
  lastStatusChangedAt?: number;
  lastResponseTimeMs?: number;
  lastError?: string | null;
  consecutiveFailures: number;
  inMaintenance: boolean;
  /** Scheduling lives here now, not in Firestore. */
  dueAt: number;
  uptime24h?: number;
  uptime7d?: number;
  uptime30d?: number;
  certExpiresAt?: number | null;
  /** Start of the validity window, so the UI can show the whole span. */
  certIssuedAt?: number | null;
  certIssuer?: string | null;
  /** Thresholds already announced for the cert currently installed. */
  certAlertedDays?: number[];
  /** The expiry those alerts were computed against — a change means renewal. */
  certAlertBasis?: number | null;

  createdAt: number;
  updatedAt: number;
}

export interface CheckResult {
  ok: boolean;
  responseTimeMs: number;
  statusCode?: number;
  error?: string;
  meta?: Record<string, unknown>;
  region: ProbeRegion;
  checkedAt: number;
}

export interface HourBucket {
  monitorId: string;
  orgId: string;
  hour: string; // "YYYYMMDDHH"
  up: number;
  down: number;
  sumMs: number;
  samples: Array<{ t: number; ms: number; ok: boolean; code?: number }>;
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
  id: string;
  orgId: string;
  monitorId: string;
  monitorName: string;
  startedAt: number;
  resolvedAt?: number | null;
  durationSeconds?: number;
  cause: string;
  confirmedBy: ProbeRegion[];
  status: "open" | "resolved";
  /** Started inside a maintenance window: recorded, but nobody is paged. */
  suppressed: boolean;
  acknowledgedBy?: string | null;
}

export type AlertChannel =
  | "email"
  | "webhook"
  | "slack"
  | "discord"
  | "telegram"
  | "fcm";

export interface AlertContact {
  id: string;
  orgId: string;
  channel: AlertChannel;
  name: string;
  destination: string;
  telegramChatId?: string;
  fcmToken?: string;
  platform?: "ios" | "android";
  enabled: boolean;
  verified: boolean;
}

export type Plan = "free" | "solo" | "team" | "scale";

export interface Org {
  id: string;
  name: string;
  ownerUid: string;
  plan: Plan;
}

/** A row in the alert outbox — the durable queue that replaces Cloud Tasks. */
export interface OutboxRow {
  id: number;
  incidentId: string;
  contactId: string;
  event: "down" | "up" | "cert";
  attempts: number;
  nextAttemptAt: number;
  status: "pending" | "sent" | "failed";
  lastError?: string | null;
}

/**
 * A message from the contact / suggestion form.
 *
 * `uid` and `orgId` are present only when the sender was signed in. Their
 * absence is what marks a message as arriving from the public form, which is
 * the less trustworthy path and the one an operator should read with more
 * suspicion.
 */
export type FeedbackKind = "suggestion" | "bug" | "question" | "other";
export type FeedbackStatus = "new" | "read" | "archived";

export interface Feedback {
  id: string;
  createdAt: number;
  kind: FeedbackKind;
  message: string;
  email: string;
  name: string;
  uid?: string | null;
  orgId?: string | null;
  source: string;
  appVersion?: string | null;
  status: FeedbackStatus;
  operatorNote: string;
}
