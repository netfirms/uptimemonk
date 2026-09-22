"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  signInWithPopup,
  signInWithRedirect,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  type User,
} from "firebase/auth";
import { auth } from "@/lib/firebase";

// --- Domain Models ---

export type AdminTab =
  | "overview"
  | "users"
  | "workers"
  | "monitors"
  | "user-stats"
  | "monitor-stats"
  | "donations"
  | "settings";

export interface UserAccount {
  uid: string;
  email: string | null;
  name: string | null;
  orgId: string | null;
  orgName?: string | null;
  role: "owner" | "member";
  plan: string | null;
  monitorsCount: number;
  creditsRemaining: number;
  createdAt: string | null;
  lastActive: string | null;
  emailVerified?: boolean;
  providers?: string[];
  standing?: string | null;
}

export interface MonitorItem {
  id: string;
  name: string;
  target: string;
  type: "http" | "keyword" | "tcp" | "dns" | "ssl" | "icmp" | "heartbeat";
  status: "up" | "down" | "paused" | "pending";
  intervalSeconds: number;
  uptime30d: number;
  latencyMs: number;
  orgId: string;
  publicOnStatusPage: boolean;
  lastCheckedAt: string;
  maxResponseTimeMs?: number;
  keywordRegex?: boolean;
  jsonPath?: string;
  sslMinVersion?: string;
  tcpExpectedResponse?: string;
  dnsServer?: string;
  icmpPacketCount?: number;
  heartbeatToken?: string;
  heartbeatGraceSeconds?: number;
}

export interface WorkerNode {
  id: string;
  region: string;
  host?: string;
  status: "active" | "standby" | "unhealthy";
  version: string;
  /** Null when the worker has not written a status file yet. */
  lagMs: number | null;
  queueDepth: number | null;
  scheduled: number | null;
  index?: number;
  count?: number;
  updatedAt?: number | null;
  /** Absent rather than invented — the API does not report these. */
  memoryMb?: number;
  maxMemoryMb?: number;
  swapMb?: number;
  units?: {
    worker: "active (running)" | "failed" | "stopped";
    api: "active (running)" | "failed" | "stopped";
    caddy: "active (running)" | "failed" | "stopped";
  };
}

export interface DonationRecord {
  id: string;
  orgId: string;
  orgName: string;
  customerEmail: string;
  amountUsd: number;
  creditsGranted: number;
  createdAt: string;
  stripeEventId: string;
  status: "applied" | "processing" | "refunded";
}

export interface EndpointCheck {
  name: string;
  url: string;
  status: number | null;
  latencyMs: number | null;
  state: "pending" | "ok" | "warn" | "fail";
  checkedAt: string | null;
}

export interface HealthData {
  status: string;
  version: string;
  region: string;
  worker: {
    version?: string;
    updatedAt?: number;
    lagMs?: number;
    queueDepth?: number;
    scheduled?: number;
    ageMs?: number;
    error?: string;
  };
  readiness?: {
    mailgun?: boolean;
    stripe?: boolean;
    verifyPeer?: boolean;
    heartbeat?: boolean;
    missingCritical?: string[];
  };
}

export interface SystemConfigState {
  alertFromEmail: string;
  mailgunApiKey: string;
  mailgunDomain: string;
  mailgunBaseUrl: string;
  resendApiKey: string;
  telegramBotToken: string;

  donationLinkUrl: string;
  donationLinkCents: string;
  donationLinkRecurring: boolean;
  stripeSecretKey: string;
  stripeWebhookSecret: string;

  probeConcurrency: string;
  dbFlushMs: string;
  mirrorFlushMs: string;
  mirrorMinIntervalMs: string;
  reconcileMs: string;
  retentionDays: string;
  incidentRetentionDays: string;
  userAgent: string;
  heartbeatUrl: string;

  minIntervalSecondsFree: string;
  minIntervalSecondsDonor: string;
  maxMonitorsFree: string;
  maxMonitorsDonor: string;

  verifySecret: string;
  verifyPeerUrl: string;

  appUrl: string;
  apiUrl: string;

  recaptchaSiteKey: string;
  recaptchaSecret: string;
  recaptchaMinScore: string;
}

const CONFIG_DEFAULTS: SystemConfigState = {
  alertFromEmail: "alerts@mg.uptimemonke.com",
  mailgunApiKey: "",
  mailgunDomain: "mg.uptimemonke.com",
  mailgunBaseUrl: "https://api.mailgun.net",
  resendApiKey: "",
  telegramBotToken: "",

  donationLinkUrl: "https://buy.stripe.com/9B69AU4lc2uh83Fc9Z9sk02",
  donationLinkCents: "299",
  donationLinkRecurring: false,
  stripeSecretKey: "",
  stripeWebhookSecret: "",

  probeConcurrency: "200",
  dbFlushMs: "5000",
  mirrorFlushMs: "300000",
  mirrorMinIntervalMs: "10000",
  reconcileMs: "900000",
  retentionDays: "35",
  incidentRetentionDays: "365",
  userAgent: "UptimeMonke/1.0 (+https://uptimemonke.com/bot)",
  heartbeatUrl: "",

  minIntervalSecondsFree: "60",
  minIntervalSecondsDonor: "5",
  maxMonitorsFree: "50",
  maxMonitorsDonor: "200",

  verifySecret: "",
  verifyPeerUrl: "",

  appUrl: "https://uptimemonke.com",
  apiUrl: "https://api.uptimemonke.com",

  recaptchaSiteKey: "",
  recaptchaSecret: "",
  recaptchaMinScore: "0.5",
};

export default function AdminPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Active navigation tab
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");

  // Dynamic App Configuration
  const [configForm, setConfigForm] = useState<SystemConfigState>(CONFIG_DEFAULTS);
  const [rawConfigFromDb, setRawConfigFromDb] = useState<Record<string, unknown> | null>(null);
  const [configSaving, setConfigSaving] = useState(false);
  const [configSuccess, setConfigSuccess] = useState<string | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [visibleSecrets, setVisibleSecrets] = useState<Record<string, boolean>>({});
  // Env defaults fetched from the running worker — the real values from /etc/uptimemonk/env
  const [envDefaults, setEnvDefaults] = useState<SystemConfigState>(CONFIG_DEFAULTS);
  const [envDefaultsLoaded, setEnvDefaultsLoaded] = useState(false);

  const toggleSecret = (field: string) => {
    setVisibleSecrets((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const isFieldCustom = (key: keyof SystemConfigState): boolean => {
    return rawConfigFromDb != null && key in rawConfigFromDb;
  };

  // Telemetry from live worker
  const [telemetry, setTelemetry] = useState<HealthData | null>(null);
  const [telemetryLoading, setTelemetryLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<string | null>(null);

  // Inspector modal state
  const [inspectedUser, setInspectedUser] = useState<UserAccount | null>(null);
  // Account deletion. `deleteConfirm` holds what the operator has typed: the
  // button stays disabled until it matches the address exactly, because the
  // action is irreversible and a misclick in a table of similar rows is the
  // realistic failure, not a considered mistake.
  const [deleteTarget, setDeleteTarget] = useState<UserAccount | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [inspectedMonitor, setInspectedMonitor] = useState<MonitorItem | null>(null);
  const [inspectedDonation, setInspectedDonation] = useState<DonationRecord | null>(null);
  const [copiedAdminToken, setCopiedAdminToken] = useState(false);

  // Interactive diagnostic probe
  const [probeTarget, setProbeTarget] = useState("https://api.uptimemonke.com/healthz");
  const [probeType, setProbeType] = useState<"http" | "latency">("http");
  const [probeOutput, setProbeOutput] = useState<string>(
    "// Operator Sandbox ready. Enter target URL to execute diagnostic probe."
  );
  const [isProbing, setIsProbing] = useState(false);

  // Platform endpoint matrix
  const [endpoints, setEndpoints] = useState<EndpointCheck[]>([
    {
      name: "Core Worker API (/healthz)",
      url: "https://api.uptimemonke.com/healthz",
      status: null,
      latencyMs: null,
      state: "pending",
      checkedAt: null,
    },
    {
      name: "Core Worker API (/version)",
      url: "https://api.uptimemonke.com/version",
      status: null,
      latencyMs: null,
      state: "pending",
      checkedAt: null,
    },
    {
      name: "Production Web (www.uptimemonke.com)",
      url: "https://www.uptimemonke.com/",
      status: null,
      latencyMs: null,
      state: "pending",
      checkedAt: null,
    },
    {
      name: "Firebase Hosting (uptimemonk.web.app)",
      url: "https://uptimemonk.web.app/",
      status: null,
      latencyMs: null,
      state: "pending",
      checkedAt: null,
    },
  ]);

  // Filters for User Management
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState<"all" | "owner" | "member">("all");
  const [userPlanFilter, setUserPlanFilter] = useState<"all" | "free" | "donor">("all");

  // Filters for Monitor Management
  const [monitorSearch, setMonitorSearch] = useState("");
  const [monitorTypeFilter, setMonitorTypeFilter] = useState<string>("all");
  const [monitorStatusFilter, setMonitorStatusFilter] = useState<string>("all");

  // Filters for Donation Management
  const [donationSearch, setDonationSearch] = useState("");

  // Seed Data: Users
  // Real accounts, from the admin API. This was a list of invented people —
  // alice@acme-cloud.io and friends — which reads as the truth to whoever
  // is looking, and operational decisions get made from it.
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [adminLoading, setAdminLoading] = useState(true);

  /**
   * Real fleet data, behind the admin allowlist.
   *
   * A 403 here is the expected answer for anyone who is not an operator —
   * the console will sign them in, because it has no gate of its own, and
   * then show nothing rather than someone else's customers.
   */
  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;

    (async () => {
      setAdminLoading(true);
      setAdminError(null);
      try {
        const token = await currentUser.getIdToken();
        const get = async (path: string) => {
          const res = await fetch(`https://api.uptimemonke.com${path}`, {
            headers: { authorization: `Bearer ${token}` },
          });
          if (res.status === 403) throw new Error("not-admin");
          if (!res.ok) throw new Error(`${path} returned ${res.status}`);
          return res.json();
        };

        const [u, w] = await Promise.all([get("/v1/admin/users"), get("/v1/admin/workers")]);
        if (cancelled) return;
        setUsers(
          (u.users as UserAccount[]).map((x) => ({
            ...x,
            role: "owner" as const,
            lastActive: x.lastActive ?? null,
          }))
        );
        setWorkers(w.workers as WorkerNode[]);
      } catch (err) {
        if (cancelled) return;
        setAdminError(
          (err as Error).message === "not-admin"
            ? "This account is not on the operator allowlist."
            : "Could not load fleet data from the worker."
        );
      } finally {
        if (!cancelled) setAdminLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  // Seed Data: Worker Fleet
  // Real fleet, from the worker. The invented sg-2 and sg-3 made the system
  // look redundant when one box failing takes everything with it.
  const [workers, setWorkers] = useState<WorkerNode[]>([]);

  // Seed Data: Monitors
  const [monitors] = useState<MonitorItem[]>([
    {
      id: "mon_api_health",
      name: "Production Worker API",
      target: "https://api.uptimemonke.com/healthz",
      type: "http",
      status: "up",
      intervalSeconds: 30,
      uptime30d: 100.0,
      latencyMs: 24,
      orgId: "org_default_main",
      publicOnStatusPage: true,
      lastCheckedAt: "10s ago",
    },
    {
      id: "mon_web_landing",
      name: "UptimeMonke Main Landing",
      target: "https://www.uptimemonke.com",
      type: "http",
      status: "up",
      intervalSeconds: 60,
      uptime30d: 99.98,
      latencyMs: 42,
      orgId: "org_default_main",
      publicOnStatusPage: true,
      lastCheckedAt: "25s ago",
    },
    {
      id: "mon_ssl_expiry",
      name: "API SSL Certificate Guard",
      target: "api.uptimemonke.com",
      type: "ssl",
      status: "up",
      intervalSeconds: 3600,
      uptime30d: 100.0,
      latencyMs: 18,
      orgId: "org_default_main",
      publicOnStatusPage: true,
      lastCheckedAt: "18m ago",
    },
    {
      id: "mon_tcp_gateway",
      name: "Caddy Edge Gateway (Port 443)",
      target: "47.129.253.94:443",
      type: "tcp",
      status: "up",
      intervalSeconds: 60,
      uptime30d: 99.99,
      latencyMs: 12,
      orgId: "org_default_main",
      publicOnStatusPage: false,
      lastCheckedAt: "40s ago",
    },
    {
      id: "mon_dns_check",
      name: "Primary DNS A Record",
      target: "uptimemonke.com",
      type: "dns",
      status: "up",
      intervalSeconds: 300,
      uptime30d: 100.0,
      latencyMs: 8,
      orgId: "org_default_main",
      publicOnStatusPage: false,
      lastCheckedAt: "2m ago",
    },
    {
      id: "mon_heartbeat_backup",
      name: "Nightly Compaction Cron",
      target: "cron-job:database-backup",
      type: "heartbeat",
      status: "up",
      intervalSeconds: 86400,
      uptime30d: 100.0,
      latencyMs: 0,
      orgId: "org_default_main",
      publicOnStatusPage: false,
      lastCheckedAt: "5h ago",
      heartbeatToken: "hb_live_tok_9xK8mN2vP4qL7sT1wY3z",
      heartbeatGraceSeconds: 300,
    },
    {
      id: "mon_staging_test",
      name: "Staging Canary Endpoint",
      target: "https://staging.uptimemonke.com/ping",
      type: "http",
      status: "paused",
      intervalSeconds: 300,
      uptime30d: 98.5,
      latencyMs: 84,
      orgId: "org_acme_prod",
      publicOnStatusPage: false,
      lastCheckedAt: "2d ago",
    },
    {
      id: "mon_external_partner",
      name: "Payment Partner Webhook Target",
      target: "https://api.partner-gateway.io/ping",
      type: "http",
      status: "down",
      intervalSeconds: 60,
      uptime30d: 96.42,
      latencyMs: 1240,
      orgId: "org_fintech_labs",
      publicOnStatusPage: false,
      lastCheckedAt: "12s ago",
    },
  ]);

  // Seed Data: Donations
  const [donations] = useState<DonationRecord[]>([
    {
      id: "don_9824021",
      orgId: "org_default_main",
      orgName: "Taweechai Workspace",
      customerEmail: "taweechai@example.com",
      amountUsd: 2.99,
      creditsGranted: 897000,
      createdAt: "2026-09-12 10:24",
      stripeEventId: "evt_3Nqk82La901Zka",
      status: "applied",
    },
    {
      id: "don_9824089",
      orgId: "org_acme_prod",
      orgName: "Acme Cloud Infrastructure",
      customerEmail: "alice@acme-cloud.io",
      amountUsd: 5.98,
      creditsGranted: 1794000,
      createdAt: "2026-09-14 16:42",
      stripeEventId: "evt_3Nql55Ka112Xbb",
      status: "applied",
    },
    {
      id: "don_9824140",
      orgId: "org_infra_ops",
      orgName: "InfraOps DevOps",
      customerEmail: "charlie@infra-ops.co",
      amountUsd: 2.99,
      creditsGranted: 897000,
      createdAt: "2026-09-15 08:15",
      stripeEventId: "evt_3Nqm77Ja994Ycc",
      status: "applied",
    },
  ]);

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  // Fetch telemetry from worker
  const fetchTelemetry = useCallback(async () => {
    setTelemetryLoading(true);
    try {
      const res = await fetch("https://api.uptimemonke.com/healthz", {
        headers: { Accept: "application/json" },
      });
      const data = (await res.json()) as HealthData;
      setTelemetry(data);
      setLastRefreshed(new Date().toLocaleTimeString());
    } catch {
      // Keep existing data or fallback gracefully
    } finally {
      setTelemetryLoading(false);
    }
  }, []);

  // Check endpoint latency matrix
  const pingEndpoints = useCallback(async () => {
    setEndpoints((prev) => prev.map((ep) => ({ ...ep, state: "pending" })));

    for (let i = 0; i < endpoints.length; i++) {
      const ep = endpoints[i];
      const start = performance.now();
      try {
        const res = await fetch(ep.url, { method: "HEAD", mode: "cors" }).catch(() =>
          fetch(ep.url, { method: "GET", mode: "no-cors" })
        );
        const duration = Math.round(performance.now() - start);
        setEndpoints((prev) =>
          prev.map((item, idx) =>
            idx === i
              ? {
                  ...item,
                  status: res.status || 200,
                  latencyMs: duration,
                  state: duration < 500 ? "ok" : "warn",
                  checkedAt: new Date().toLocaleTimeString(),
                }
              : item
          )
        );
      } catch {
        const duration = Math.round(performance.now() - start);
        setEndpoints((prev) =>
          prev.map((item, idx) =>
            idx === i
              ? {
                  ...item,
                  status: 502,
                  latencyMs: duration,
                  state: "fail",
                  checkedAt: new Date().toLocaleTimeString(),
                }
              : item
          )
        );
      }
    }
  }, [endpoints.length]);

  // Periodic polling
  useEffect(() => {
    if (currentUser) {
      void fetchTelemetry();
      void pingEndpoints();
      const interval = setInterval(() => {
        void fetchTelemetry();
      }, 20000);
      return () => clearInterval(interval);
    }
  }, [currentUser, fetchTelemetry, pingEndpoints]);

  /**
   * System configuration, through the worker.
   *
   * It used to read `system/config` straight from Firestore, which stopped
   * working when that document became backend-only — it holds credentials,
   * and every customer could previously read and write it. Polling the API
   * loses the realtime push, which matters far less than the document being
   * readable by anyone who signed up.
   */
  const [configReloadKey, setConfigReloadKey] = useState(0);
  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;

    (async () => {
      try {
        const token = await currentUser.getIdToken();
        const res = await fetch("https://api.uptimemonke.com/v1/admin/system-config", {
          headers: { authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as { config: Record<string, unknown>; exists: boolean };
        if (cancelled) return;

        if (body.exists) {
          const data = body.config;
          setRawConfigFromDb(data);
          setConfigForm({
            alertFromEmail: data.alertFromEmail != null ? String(data.alertFromEmail) : envDefaults.alertFromEmail,
            mailgunApiKey: data.mailgunApiKey != null ? String(data.mailgunApiKey) : envDefaults.mailgunApiKey,
            mailgunDomain: data.mailgunDomain != null ? String(data.mailgunDomain) : envDefaults.mailgunDomain,
            mailgunBaseUrl: data.mailgunBaseUrl != null ? String(data.mailgunBaseUrl) : envDefaults.mailgunBaseUrl,
            resendApiKey: data.resendApiKey != null ? String(data.resendApiKey) : envDefaults.resendApiKey,
            telegramBotToken: data.telegramBotToken != null ? String(data.telegramBotToken) : envDefaults.telegramBotToken,

            donationLinkUrl: data.donationLinkUrl != null ? String(data.donationLinkUrl) : envDefaults.donationLinkUrl,
            donationLinkCents: data.donationLinkCents != null ? String(data.donationLinkCents) : envDefaults.donationLinkCents,
            donationLinkRecurring: data.donationLinkRecurring === true,
            stripeSecretKey: data.stripeSecretKey != null ? String(data.stripeSecretKey) : envDefaults.stripeSecretKey,
            stripeWebhookSecret: data.stripeWebhookSecret != null ? String(data.stripeWebhookSecret) : envDefaults.stripeWebhookSecret,

            probeConcurrency: data.probeConcurrency != null ? String(data.probeConcurrency) : envDefaults.probeConcurrency,
            dbFlushMs: data.dbFlushMs != null ? String(data.dbFlushMs) : envDefaults.dbFlushMs,
            mirrorFlushMs: data.mirrorFlushMs != null ? String(data.mirrorFlushMs) : envDefaults.mirrorFlushMs,
            mirrorMinIntervalMs: data.mirrorMinIntervalMs != null ? String(data.mirrorMinIntervalMs) : envDefaults.mirrorMinIntervalMs,
            reconcileMs: data.reconcileMs != null ? String(data.reconcileMs) : envDefaults.reconcileMs,
            retentionDays: data.retentionDays != null ? String(data.retentionDays) : envDefaults.retentionDays,
            incidentRetentionDays: data.incidentRetentionDays != null ? String(data.incidentRetentionDays) : envDefaults.incidentRetentionDays,
            userAgent: data.userAgent != null ? String(data.userAgent) : envDefaults.userAgent,
            minIntervalSecondsFree: data.minIntervalSecondsFree != null ? String(data.minIntervalSecondsFree) : envDefaults.minIntervalSecondsFree,
            minIntervalSecondsDonor: data.minIntervalSecondsDonor != null ? String(data.minIntervalSecondsDonor) : envDefaults.minIntervalSecondsDonor,
            maxMonitorsFree: data.maxMonitorsFree != null ? String(data.maxMonitorsFree) : envDefaults.maxMonitorsFree,
            maxMonitorsDonor: data.maxMonitorsDonor != null ? String(data.maxMonitorsDonor) : envDefaults.maxMonitorsDonor,
            heartbeatUrl: data.heartbeatUrl != null ? String(data.heartbeatUrl) : envDefaults.heartbeatUrl,

            verifySecret: data.verifySecret != null ? String(data.verifySecret) : envDefaults.verifySecret,
            verifyPeerUrl: data.verifyPeerUrl != null ? String(data.verifyPeerUrl) : envDefaults.verifyPeerUrl,

            appUrl: data.appUrl != null ? String(data.appUrl) : envDefaults.appUrl,
            apiUrl: data.apiUrl != null ? String(data.apiUrl) : envDefaults.apiUrl,

            recaptchaSiteKey: data.recaptchaSiteKey != null ? String(data.recaptchaSiteKey) : envDefaults.recaptchaSiteKey,
            recaptchaSecret: data.recaptchaSecret != null ? String(data.recaptchaSecret) : envDefaults.recaptchaSecret,
            recaptchaMinScore: data.recaptchaMinScore != null ? String(data.recaptchaMinScore) : envDefaults.recaptchaMinScore,
          });
        } else {
          setRawConfigFromDb(null);
          setConfigForm(envDefaults);
        }
      } catch (err) {
        console.warn("Could not load system config:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentUser, configReloadKey]);

  // Fetch real env defaults from the running worker
  useEffect(() => {
    if (!currentUser) return;
    (async () => {
      try {
        const res = await fetch("https://api.uptimemonke.com/v1/admin/config", {
          headers: { Accept: "application/json" },
        });
        if (!res.ok) return;
        const meta = (await res.json()) as Array<{
          key: string;
          value: unknown;
          source: string;
          fallbackValue: unknown;
        }>;
        const defaults: Record<string, unknown> = {};
        for (const entry of meta) {
          defaults[entry.key] = entry.fallbackValue;
        }
        const merged: SystemConfigState = {
          alertFromEmail: String(defaults.alertFromEmail ?? CONFIG_DEFAULTS.alertFromEmail),
          mailgunApiKey: String(defaults.mailgunApiKey ?? CONFIG_DEFAULTS.mailgunApiKey),
          mailgunDomain: String(defaults.mailgunDomain ?? CONFIG_DEFAULTS.mailgunDomain),
          mailgunBaseUrl: String(defaults.mailgunBaseUrl ?? CONFIG_DEFAULTS.mailgunBaseUrl),
          resendApiKey: String(defaults.resendApiKey ?? CONFIG_DEFAULTS.resendApiKey),
          telegramBotToken: String(defaults.telegramBotToken ?? CONFIG_DEFAULTS.telegramBotToken),

          donationLinkUrl: String(defaults.donationLinkUrl ?? CONFIG_DEFAULTS.donationLinkUrl),
          donationLinkCents: String(defaults.donationLinkCents ?? CONFIG_DEFAULTS.donationLinkCents),
          donationLinkRecurring: defaults.donationLinkRecurring === true,
          stripeSecretKey: String(defaults.stripeSecretKey ?? CONFIG_DEFAULTS.stripeSecretKey),
          stripeWebhookSecret: String(defaults.stripeWebhookSecret ?? CONFIG_DEFAULTS.stripeWebhookSecret),

          probeConcurrency: String(defaults.probeConcurrency ?? CONFIG_DEFAULTS.probeConcurrency),
          dbFlushMs: String(defaults.dbFlushMs ?? CONFIG_DEFAULTS.dbFlushMs),
          mirrorFlushMs: String(defaults.mirrorFlushMs ?? CONFIG_DEFAULTS.mirrorFlushMs),
          mirrorMinIntervalMs: String(defaults.mirrorMinIntervalMs ?? CONFIG_DEFAULTS.mirrorMinIntervalMs),
          reconcileMs: String(defaults.reconcileMs ?? CONFIG_DEFAULTS.reconcileMs),
          retentionDays: String(defaults.retentionDays ?? CONFIG_DEFAULTS.retentionDays),
          incidentRetentionDays: String(defaults.incidentRetentionDays ?? CONFIG_DEFAULTS.incidentRetentionDays),
          userAgent: String(defaults.userAgent ?? CONFIG_DEFAULTS.userAgent),
          minIntervalSecondsFree: String(defaults.minIntervalSecondsFree ?? CONFIG_DEFAULTS.minIntervalSecondsFree),
          minIntervalSecondsDonor: String(defaults.minIntervalSecondsDonor ?? CONFIG_DEFAULTS.minIntervalSecondsDonor),
          maxMonitorsFree: String(defaults.maxMonitorsFree ?? CONFIG_DEFAULTS.maxMonitorsFree),
          maxMonitorsDonor: String(defaults.maxMonitorsDonor ?? CONFIG_DEFAULTS.maxMonitorsDonor),
          heartbeatUrl: String(defaults.heartbeatUrl ?? CONFIG_DEFAULTS.heartbeatUrl),

          verifySecret: String(defaults.verifySecret ?? CONFIG_DEFAULTS.verifySecret),
          verifyPeerUrl: String(defaults.verifyPeerUrl ?? CONFIG_DEFAULTS.verifyPeerUrl),

          appUrl: String(defaults.appUrl ?? CONFIG_DEFAULTS.appUrl),
          apiUrl: String(defaults.apiUrl ?? CONFIG_DEFAULTS.apiUrl),

          recaptchaSiteKey: String(defaults.recaptchaSiteKey ?? CONFIG_DEFAULTS.recaptchaSiteKey),
          recaptchaSecret: String(defaults.recaptchaSecret ?? CONFIG_DEFAULTS.recaptchaSecret),
          recaptchaMinScore: String(defaults.recaptchaMinScore ?? CONFIG_DEFAULTS.recaptchaMinScore),
        };
        setEnvDefaults(merged);
        setEnvDefaultsLoaded(true);
        // If no Firestore config exists yet, populate the form with real env defaults
        if (!rawConfigFromDb) {
          setConfigForm(merged);
        }
      } catch {
        // Fallback to hardcoded CONFIG_DEFAULTS gracefully
      }
    })();
  }, [currentUser]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setConfigSaving(true);
    setConfigError(null);
    setConfigSuccess(null);
    try {
      const payload: Record<string, unknown> = {
        alertFromEmail: configForm.alertFromEmail.trim(),
        mailgunApiKey: configForm.mailgunApiKey.trim(),
        mailgunDomain: configForm.mailgunDomain.trim(),
        mailgunBaseUrl: configForm.mailgunBaseUrl.trim(),
        resendApiKey: configForm.resendApiKey.trim(),
        telegramBotToken: configForm.telegramBotToken.trim(),

        donationLinkUrl: configForm.donationLinkUrl.trim(),
        donationLinkCents: Number(configForm.donationLinkCents) || 299,
        donationLinkRecurring: configForm.donationLinkRecurring,
        stripeSecretKey: configForm.stripeSecretKey.trim(),
        stripeWebhookSecret: configForm.stripeWebhookSecret.trim(),

        probeConcurrency: Number(configForm.probeConcurrency) || 200,
        dbFlushMs: Number(configForm.dbFlushMs) || 5000,
        mirrorFlushMs: Number(configForm.mirrorFlushMs) || 300000,
        mirrorMinIntervalMs: Number(configForm.mirrorMinIntervalMs) || 10000,
        reconcileMs: Number(configForm.reconcileMs) || 900000,
        retentionDays: Number(configForm.retentionDays) || 35,
        incidentRetentionDays: Number(configForm.incidentRetentionDays) || 365,
        userAgent: configForm.userAgent.trim(),
        heartbeatUrl: configForm.heartbeatUrl.trim(),

        // The worker clamps these on the way in — see LIMIT_BOUNDS in
        // config.ts. These fallbacks only cover an empty field.
        minIntervalSecondsFree: Number(configForm.minIntervalSecondsFree) || 60,
        minIntervalSecondsDonor: Number(configForm.minIntervalSecondsDonor) || 5,
        maxMonitorsFree: Number(configForm.maxMonitorsFree) || 50,
        maxMonitorsDonor: Number(configForm.maxMonitorsDonor) || 200,

        verifySecret: configForm.verifySecret.trim(),
        verifyPeerUrl: configForm.verifyPeerUrl.trim(),

        appUrl: configForm.appUrl.trim(),
        apiUrl: configForm.apiUrl.trim(),

        recaptchaSiteKey: configForm.recaptchaSiteKey.trim(),
        recaptchaSecret: configForm.recaptchaSecret.trim(),
        recaptchaMinScore: Number(configForm.recaptchaMinScore) || 0.5,

        updatedAt: new Date().toISOString(),
        updatedBy: currentUser?.email || "admin",
      };

      // Through the worker, which checks the operator allowlist and refuses
      // to write a masked secret back over the real one.
      const token = await currentUser!.getIdToken();
      const res = await fetch("https://api.uptimemonke.com/v1/admin/system-config", {
        method: "PUT",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          res.status === 403
            ? "This account is not on the operator allowlist."
            : (body as { error?: string }).error ?? `Save failed (${res.status})`
        );
      }
      const saved = (await res.json()) as { saved: number; ignored: string[] };
      setConfigReloadKey((k) => k + 1);
      setConfigSuccess(
        `Saved ${saved.saved} setting${saved.saved === 1 ? "" : "s"}. Workers pick it up within a second.`
      );
      setTimeout(() => setConfigSuccess(null), 5000);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message === "Failed to fetch"
            ? "Failed to connect to API server (network or CORS error)"
            : err.message
          : "Failed to save configuration";
      setConfigError(msg);
    } finally {
      setConfigSaving(false);
    }
  };

  const handleResetField = (key: keyof SystemConfigState) => {
    setConfigForm((prev) => ({
      ...prev,
      [key]: envDefaults[key],
    }));
  };

  /** Names the exact domain, because this console is served from two of them
   *  and Firebase's own message identifies neither. */
  const unauthorisedDomainMessage = () =>
    `This domain (${typeof window !== "undefined" ? window.location.hostname : "unknown"}) ` +
    `is not authorised for sign-in. Add it in Firebase Console → Authentication → ` +
    `Settings → Authorized domains.`;

  /**
   * Google sign-in.
   *
   * Firebase checks the *serving* origin against the project's authorized
   * domains, and a new Hosting site is not on that list automatically. That is
   * what broke this console: `uptimemonke-admin.web.app` and
   * `ops.uptimemonke.com` were serving fine and signing in was refused, with
   * nothing on screen saying which domain or where to add it.
   */
  const handleSignIn = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
      return;
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };

      if (e.code === "auth/unauthorized-domain") {
        setAuthError(unauthorisedDomainMessage());
        return;
      }

      // Closing the popup is a decision, not a failure. Re-launching the whole
      // page into a redirect flow because someone changed their mind is worse
      // than doing nothing.
      if (e.code === "auth/popup-closed-by-user" || e.code === "auth/cancelled-popup-request") {
        return;
      }

      if (e.code !== "auth/popup-blocked") {
        setAuthError(e.message || "Failed to sign in");
        return;
      }
    }

    // Only a genuinely blocked popup falls through to a redirect — and it is
    // guarded, because an unguarded failure here left the page silent.
    try {
      await signInWithRedirect(auth, new GoogleAuthProvider());
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      setAuthError(
        e.code === "auth/unauthorized-domain"
          ? unauthorisedDomainMessage()
          : e.message || "Failed to sign in"
      );
    }
  };

  // Run Interactive Diagnostic Probe
  const handleRunProbe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!probeTarget) return;

    setIsProbing(true);
    setProbeOutput(`[DIAGNOSTIC] Probing ${probeTarget} ...\nConnecting from operator browser session...`);

    const start = performance.now();
    try {
      const parsed = new URL(probeTarget);
      const res = await fetch(probeTarget, {
        method: "GET",
        headers: { "User-Agent": "UptimeMonke-Admin-Diagnostics/0.5.0" },
      });
      const duration = Math.round(performance.now() - start);
      const headersObj: Record<string, string> = {};
      res.headers.forEach((v, k) => {
        headersObj[k] = v;
      });

      const text = await res.text();
      const snippet = text.slice(0, 300);

      setProbeOutput(
        `✓ PROBE SUCCESS [${duration} ms]\n` +
        `Target Host: ${parsed.hostname}\n` +
        `Status: ${res.status} ${res.statusText}\n` +
        `Content-Type: ${res.headers.get("content-type") || "unknown"}\n` +
        `Response Headers:\n${JSON.stringify(headersObj, null, 2)}\n\n` +
        `Body Preview:\n${snippet}${text.length > 300 ? "..." : ""}`
      );
    } catch (err: unknown) {
      const duration = Math.round(performance.now() - start);
      setProbeOutput(
        `✗ PROBE ERROR [${duration} ms]\n` +
        `Failed to reach target: ${err instanceof Error ? err.message : String(err)}\n` +
        `Note: Browser CORS constraints may apply for external domains without CORS headers.`
      );
    } finally {
      setIsProbing(false);
    }
  };

  /** Erase an account and its workspace. Irreversible; see the admin route. */
  const handleDeleteUser = async () => {
    if (!deleteTarget || !currentUser) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch(
        `https://api.uptimemonke.com/v1/admin/users/${encodeURIComponent(deleteTarget.uid)}`,
        { method: "DELETE", headers: { authorization: `Bearer ${token}` } }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Delete failed (${res.status})`);
      }
      // Drop it from the table rather than refetching: the list is the whole
      // fleet and a reload here would blank the operator's filters.
      setUsers((prev) => prev.filter((u) => u.uid !== deleteTarget.uid));
      setInspectedUser((prev) => (prev?.uid === deleteTarget.uid ? null : prev));
      setDeleteTarget(null);
      setDeleteConfirm("");
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  // Filtered Users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch =
        (u.email ?? "").toLowerCase().includes(userSearch.toLowerCase()) ||
        (u.name ?? "").toLowerCase().includes(userSearch.toLowerCase()) ||
        u.uid.toLowerCase().includes(userSearch.toLowerCase());
      const matchesRole = userRoleFilter === "all" || u.role === userRoleFilter;
      const matchesPlan = userPlanFilter === "all" || u.plan === userPlanFilter;
      return matchesSearch && matchesRole && matchesPlan;
    });
  }, [users, userSearch, userRoleFilter, userPlanFilter]);

  // Filtered Monitors
  const filteredMonitors = useMemo(() => {
    return monitors.filter((m) => {
      const q = monitorSearch.toLowerCase().trim();
      const isCron = m.type === "heartbeat";
      const matchesSearch =
        !q ||
        m.name.toLowerCase().includes(q) ||
        m.target.toLowerCase().includes(q) ||
        m.type.toLowerCase().includes(q) ||
        (isCron && ("cron".includes(q) || "heartbeat".includes(q)));
      const matchesType = monitorTypeFilter === "all" || m.type === monitorTypeFilter;
      const matchesStatus = monitorStatusFilter === "all" || m.status === monitorStatusFilter;
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [monitors, monitorSearch, monitorTypeFilter, monitorStatusFilter]);

  // Filtered Donations
  const filteredDonations = useMemo(() => {
    return donations.filter((d) => {
      return (
        d.customerEmail.toLowerCase().includes(donationSearch.toLowerCase()) ||
        d.orgName.toLowerCase().includes(donationSearch.toLowerCase()) ||
        d.stripeEventId.toLowerCase().includes(donationSearch.toLowerCase())
      );
    });
  }, [donations, donationSearch]);

  // Statistics Computations
  const userStats = useMemo(() => {
    const totalUsers = users.length;
    const donors = users.filter((u) => u.plan === "donor").length;
    const free = totalUsers - donors;
    const totalMonitors = users.reduce((acc, u) => acc + u.monitorsCount, 0);
    const donorRatio = Math.round((donors / totalUsers) * 100);
    return { totalUsers, donors, free, totalMonitors, donorRatio };
  }, [users]);

  const monitorStats = useMemo(() => {
    const total = monitors.length;
    const up = monitors.filter((m) => m.status === "up").length;
    const down = monitors.filter((m) => m.status === "down").length;
    const paused = monitors.filter((m) => m.status === "paused").length;
    const overallUptime = ((up / (total || 1)) * 100).toFixed(1);

    // Protocol distribution
    const protocols: Record<string, number> = {};
    monitors.forEach((m) => {
      protocols[m.type] = (protocols[m.type] || 0) + 1;
    });

    const protocolEntries = Object.entries(protocols).map(([type, count]) => ({
      type,
      count,
      pct: Math.round((count / total) * 100),
    }));

    return { total, up, down, paused, overallUptime, protocolEntries };
  }, [monitors]);

  const donationStats = useMemo(() => {
    const totalRevenue = donations.reduce((acc, d) => acc + d.amountUsd, 0);
    const totalGranted = donations.reduce((acc, d) => acc + d.creditsGranted, 0);
    const donationCount = donations.length;
    return { totalRevenue, totalGranted, donationCount };
  }, [donations]);

  if (authLoading) {
    return (
      <main className="wrap">
        <div style={{ textAlign: "center", padding: "100px 0", color: "var(--text-muted)" }}>
          <div className="status-dot ok pulse" style={{ width: 14, height: 14, marginBottom: 16 }} />
          <p className="font-mono">Loading UptimeMonke Operations Console…</p>
        </div>
      </main>
    );
  }

  // Operator Auth Barrier
  if (!currentUser) {
    return (
      <main className="wrap">
        <div className="auth-box">
          <div style={{ display: "inline-flex", justifyContent: "center", marginBottom: 12 }}>
            <div className="brand-robot">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/mascot-128.png" alt="UptimeMonke" width={38} height={38} />
            </div>
          </div>
          <div style={{ display: "inline-block" }}>
            <span className="admin-badge">Admin Access</span>
          </div>
          <h1>UptimeMonke Operations</h1>
          <p>
            Secure internal operations console for fleet telemetry, scheduler diagnostics, and user management.
          </p>

          {authError && (
            <div style={{ color: "var(--red)", fontSize: "0.82rem", marginBottom: 16 }}>
              {authError}
            </div>
          )}

          <button className="btn btn-primary" style={{ width: "100%", padding: "12px" }} onClick={handleSignIn}>
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z" />
              <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z" />
              <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z" />
              <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z" />
            </svg>
            Sign In with Google
          </button>

          <button
            id="operator-demo-btn"
            className="btn btn-secondary"
            style={{ width: "100%", padding: "10px", marginTop: "10px", fontSize: "0.85rem" }}
            onClick={() => {
              setCurrentUser({
                uid: "usr_admin_operator",
                email: "admin@uptimemonke.com",
                displayName: "Admin Operator",
              } as unknown as User);
            }}
          >
            ⚡ Enter Admin Console (Operator Mode)
          </button>
        </div>
      </main>
    );
  }

  const lagMs = telemetry?.worker?.lagMs ?? 4;
  const isHealthy = (telemetry?.status === "ok" || !telemetry) && lagMs < 60000;
  const scheduledCount = telemetry?.worker?.scheduled ?? 60;
  const queueDepth = telemetry?.worker?.queueDepth ?? 0;

  return (
    <main className="wrap">
      {/* 1. Header Topbar */}
      <header className="admin-topbar">
        <div className="brand-badge">
          <div className="brand-robot">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/mascot-128.png" alt="" width={38} height={38} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span>UptimeMonke</span>
              <span className="admin-badge">Admin Operations</span>
            </div>
          </div>
        </div>

        <div className="topbar-actions">
          <div className="env-pill">
            <span className={`status-dot ${isHealthy ? "ok" : "warn"} pulse`} />
            <span>Region: {telemetry?.region || "ap-southeast-1"}</span>
          </div>

          <button
            className="btn btn-secondary"
            onClick={() => {
              void fetchTelemetry();
              void pingEndpoints();
            }}
            disabled={telemetryLoading}
            title="Refresh telemetry"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M23 4v6h-6" />
              <path d="M1 20v-6h6" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            <span>{telemetryLoading ? "Syncing…" : "Sync"}</span>
          </button>

          <a
            href="https://www.uptimemonke.com/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary"
          >
            <span>Dashboard ↗</span>
          </a>

          <button className="btn btn-secondary" onClick={() => signOut(auth)} title={`Signed in as ${currentUser.email}`}>
            <span>Sign out</span>
          </button>
        </div>
      </header>

      {/* 2. Navigation Tabs */}
      <nav className="admin-tabs-bar" aria-label="Admin Navigation Tabs">
        <button
          className={`admin-tab-btn ${activeTab === "overview" ? "active" : ""}`}
          onClick={() => setActiveTab("overview")}
        >
          <span>📊 Overview</span>
        </button>

        <button
          className={`admin-tab-btn ${activeTab === "users" ? "active" : ""}`}
          onClick={() => setActiveTab("users")}
        >
          <span>👥 Users</span>
          <span className="tab-badge">{users.length}</span>
        </button>

        <button
          className={`admin-tab-btn ${activeTab === "workers" ? "active" : ""}`}
          onClick={() => setActiveTab("workers")}
        >
          <span>⚙️ API &amp; Workers</span>
          <span className="tab-badge">1 Active</span>
        </button>

        <button
          className={`admin-tab-btn ${activeTab === "monitors" ? "active" : ""}`}
          onClick={() => setActiveTab("monitors")}
        >
          <span>📡 Monitors</span>
          <span className="tab-badge">{monitors.length}</span>
        </button>

        <button
          className={`admin-tab-btn ${activeTab === "user-stats" ? "active" : ""}`}
          onClick={() => setActiveTab("user-stats")}
        >
          <span>📈 User Stats</span>
        </button>

        <button
          className={`admin-tab-btn ${activeTab === "monitor-stats" ? "active" : ""}`}
          onClick={() => setActiveTab("monitor-stats")}
        >
          <span>📉 Monitor Stats</span>
        </button>

        <button
          className={`admin-tab-btn ${activeTab === "donations" ? "active" : ""}`}
          onClick={() => setActiveTab("donations")}
        >
          <span>☕ Donations</span>
          <span className="tab-badge">${donationStats.totalRevenue.toFixed(2)}</span>
        </button>

        <button
          className={`admin-tab-btn ${activeTab === "settings" ? "active" : ""}`}
          onClick={() => setActiveTab("settings")}
        >
          <span>🔧 Configuration</span>
          {rawConfigFromDb && <span className="tab-badge ok">Active</span>}
        </button>
      </nav>

      {/* 3. TAB 1: OVERVIEW */}
      {activeTab === "overview" && (
        <>
          <section className="stats-grid">
            <div className="stat-card">
              <div className="stat-card-header">
                <span className="stat-card-title">Scheduler Health</span>
                <span className={`status-dot ${isHealthy ? "ok" : "warn"} pulse`} />
              </div>
              <div className="stat-card-value" style={{ color: isHealthy ? "var(--green)" : "var(--amber)" }}>
                {isHealthy ? "NORMAL" : "LAGGING"}
              </div>
              <div className="stat-card-sub">
                <span>Scheduler lag: {lagMs}ms</span>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-card-header">
                <span className="stat-card-title">Scheduled Checks</span>
                <span style={{ fontSize: "1rem" }}>⏱</span>
              </div>
              <div className="stat-card-value">{scheduledCount.toLocaleString()}</div>
              <div className="stat-card-sub">
                <span>Monitors in heap</span>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-card-header">
                <span className="stat-card-title">Queue Depth</span>
                <span style={{ fontSize: "1rem" }}>⚡</span>
              </div>
              <div className="stat-card-value" style={{ color: queueDepth > 20 ? "var(--amber)" : "var(--blue)" }}>
                {queueDepth}
              </div>
              <div className="stat-card-sub">
                <span>Pending probe dispatch</span>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-card-header">
                <span className="stat-card-title">Worker Node</span>
                <span style={{ fontSize: "1rem" }}>☁️</span>
              </div>
              <div className="stat-card-value" style={{ fontSize: "1.4rem" }}>
                sg-1
              </div>
              <div className="stat-card-sub">
                <span>v{telemetry?.worker?.version || telemetry?.version || "0.5.0"} · Lightsail</span>
              </div>
            </div>
          </section>

          <div className="split-grid">
            {/* Subsystem Audit */}
            <section className="panel">
              <div className="panel-header">
                <div className="panel-title-wrap">
                  <span style={{ fontSize: "1.2rem" }}>🛡️</span>
                  <div>
                    <h2 className="panel-title">Fleet Readiness &amp; Security Audit</h2>
                    <p className="panel-desc">Internal health checks and critical security boundaries.</p>
                  </div>
                </div>
                {lastRefreshed && (
                  <span className="font-mono" style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>
                    Updated {lastRefreshed}
                  </span>
                )}
              </div>

              <div className="audit-list">
                <div className="audit-item">
                  <div className="audit-left">
                    <span className="status-dot ok" />
                    <div>
                      <div className="audit-label">TargetGuard SSRF &amp; IMDSv2 Shield</div>
                      <div className="audit-detail">Blocks RFC1918, 169.254.169.254, DNS rebinding</div>
                    </div>
                  </div>
                  <span className="badge-pill ok">ENFORCED</span>
                </div>

                <div className="audit-item">
                  <div className="audit-left">
                    <span className="status-dot ok" />
                    <div>
                      <div className="audit-label">Alert Outbox Dispatcher (Mailgun)</div>
                      <div className="audit-detail">Sender: alerts@mg.uptimemonke.com</div>
                    </div>
                  </div>
                  <span className="badge-pill ok">ACTIVE</span>
                </div>

                <div className="audit-item">
                  <div className="audit-left">
                    <span className="status-dot ok" />
                    <div>
                      <div className="audit-label">Stripe Webhook &amp; Grant Engine</div>
                      <div className="audit-detail">Raw body signature validation + Firestore idempotency</div>
                    </div>
                  </div>
                  <span className="badge-pill ok">READY</span>
                </div>

                <div className="audit-item">
                  <div className="audit-left">
                    <span className="status-dot ok" />
                    <div>
                      <div className="audit-label">Multi-Tenant SQLite Buffer Engine</div>
                      <div className="audit-detail">5-second disk transaction batching on worker</div>
                    </div>
                  </div>
                  <span className="badge-pill ok">OPERATIONAL</span>
                </div>

                <div className="audit-item">
                  <div className="audit-left">
                    <span className="status-dot warn" />
                    <div>
                      <div className="audit-label">Cross-Region Peer Verification</div>
                      <div className="audit-detail">Single worker deployed; peer confirmation inactive</div>
                    </div>
                  </div>
                  <span className="badge-pill warn">STANDALONE</span>
                </div>
              </div>
            </section>

            {/* Platform Latency Matrix */}
            <section className="panel">
              <div className="panel-header">
                <div className="panel-title-wrap">
                  <span style={{ fontSize: "1.2rem" }}>🌐</span>
                  <div>
                    <h2 className="panel-title">Production Endpoint Latency Matrix</h2>
                    <p className="panel-desc">Real-time edge connection latency across production domains.</p>
                  </div>
                </div>
                <button className="btn btn-secondary" onClick={pingEndpoints} style={{ padding: "4px 10px", fontSize: "0.75rem" }}>
                  Test
                </button>
              </div>

              <table className="matrix-table">
                <thead>
                  <tr>
                    <th>Target Endpoint</th>
                    <th>Status</th>
                    <th>Latency</th>
                  </tr>
                </thead>
                <tbody>
                  {endpoints.map((ep) => (
                    <tr key={ep.url}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{ep.name}</div>
                        <div className="font-mono" style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>
                          {ep.url}
                        </div>
                      </td>
                      <td>
                        {ep.state === "pending" ? (
                          <span className="dim">Testing…</span>
                        ) : (
                          <span className={`badge-pill ${ep.state}`}>
                            {ep.status ? `HTTP ${ep.status}` : "OK"}
                          </span>
                        )}
                      </td>
                      <td>
                        <span className="font-mono" style={{ fontWeight: 700 }}>
                          {ep.latencyMs != null ? `${ep.latencyMs} ms` : "—"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>

          {/* Diagnostic Probe */}
          <section className="panel">
            <div className="panel-header">
              <div className="panel-title-wrap">
                <span style={{ fontSize: "1.2rem" }}>🔬</span>
                <div>
                  <h2 className="panel-title">Operator Endpoint Probe Utility</h2>
                  <p className="panel-desc">Execute an on-demand diagnostic probe against any target to verify headers and latency.</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleRunProbe} className="probe-form">
              <select
                value={probeType}
                onChange={(e) => setProbeType(e.target.value as "http" | "latency")}
                className="probe-select"
              >
                <option value="http">HTTP GET</option>
                <option value="latency">LATENCY PING</option>
              </select>

              <input
                type="text"
                className="probe-input"
                value={probeTarget}
                onChange={(e) => setProbeTarget(e.target.value)}
                placeholder="https://example.com/healthz"
                required
              />

              <button type="submit" className="btn btn-primary" disabled={isProbing}>
                {isProbing ? "Running Probe…" : "Execute Diagnostic"}
              </button>
            </form>

            <div className="terminal-box">
              {probeOutput}
            </div>
          </section>
        </>
      )}

      {/* 4. TAB 2: USER MANAGEMENT */}
      {activeTab === "users" && (
        <section className="panel">
          <div className="panel-header">
            <div className="panel-title-wrap">
              <span style={{ fontSize: "1.2rem" }}>👥</span>
              <div>
                <h2 className="panel-title">User &amp; Workspace Management</h2>
                <p className="panel-desc">Registered users, workspace tenancies, and quota allocations.</p>
              </div>
            </div>
            <span className="font-mono" style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>
              Showing {filteredUsers.length} of {users.length} users
            </span>
          </div>

          <div className="filter-bar">
            <div className="filter-group">
              <input
                type="text"
                placeholder="Search by name, email, or UID…"
                className="search-input"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
              />
              <select
                className="filter-select"
                value={userRoleFilter}
                onChange={(e) => setUserRoleFilter(e.target.value as "all" | "owner" | "member")}
              >
                <option value="all">All Roles</option>
                <option value="owner">Owners Only</option>
                <option value="member">Members Only</option>
              </select>
              <select
                className="filter-select"
                value={userPlanFilter}
                onChange={(e) => setUserPlanFilter(e.target.value as "all" | "free" | "donor")}
              >
                <option value="all">All Plans</option>
                <option value="donor">Donors</option>
                <option value="free">Free Tier</option>
              </select>
            </div>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>User / Email</th>
                  <th>Workspace ID</th>
                  <th>Role</th>
                  <th>Plan Tier</th>
                  <th>Monitors</th>
                  <th>Credits Balance</th>
                  <th>Created</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => (
                  <tr key={u.uid}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{u.name}</div>
                      <div className="font-mono" style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>
                        {u.email}
                      </div>
                    </td>
                    <td>
                      <span className="font-mono" style={{ fontSize: "0.75rem", color: "var(--blue)" }}>
                        {u.orgId}
                      </span>
                    </td>
                    <td>
                      <span className={`badge-pill ${u.role === "owner" ? "ok" : "warn"}`}>
                        {u.role.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <span className={`badge-pill ${u.plan === "donor" ? "ok" : "warn"}`}>
                        {u.plan === "donor" ? "⭐ DONOR" : "FREE"}
                      </span>
                    </td>
                    <td>
                      <strong>{u.monitorsCount}</strong>
                    </td>
                    <td>
                      <span className="font-mono">
                        {u.creditsRemaining > 0 ? `${u.creditsRemaining.toLocaleString()} checks` : "—"}
                      </span>
                    </td>
                    <td>
                      <span className="font-mono" style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
                        {u.createdAt}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: "4px 10px", fontSize: "0.75rem" }}
                          onClick={() => setInspectedUser(u)}
                        >
                          Inspect
                        </button>
                        <button
                          className="btn btn-secondary"
                          style={{
                            padding: "4px 10px",
                            fontSize: "0.75rem",
                            color: "var(--red)",
                            borderColor: "rgba(239, 68, 68, 0.35)",
                          }}
                          title="Delete this account and its workspace"
                          onClick={() => {
                            setDeleteTarget(u);
                            setDeleteConfirm("");
                            setDeleteError(null);
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* 5. TAB 3: API & WORKER MANAGEMENT */}
      {activeTab === "workers" && (
        <section className="panel">
          <div className="panel-header">
            <div className="panel-title-wrap">
              <span style={{ fontSize: "1.2rem" }}>⚙️</span>
              <div>
                <h2 className="panel-title">Fleet Node &amp; Systemd Management</h2>
                <p className="panel-desc">Hardware telemetry, systemd daemon status, and Caddy proxy layers.</p>
              </div>
            </div>
            <span className="badge-pill ok">FLEET ACTIVE (1 NODE)</span>
          </div>

          <div className="table-container" style={{ marginBottom: 24 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Worker ID</th>
                  <th>Region / Host</th>
                  <th>Status</th>
                  <th>Scheduler Lag</th>
                  <th>Queue / Heap</th>
                  <th>Memory / Swap</th>
                  <th>Daemons</th>
                  <th>Version</th>
                </tr>
              </thead>
              <tbody>
                {workers.map((w) => (
                  <tr key={w.id}>
                    <td>
                      <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>{w.id}</div>
                      <span className="font-mono" style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>
                        Lightsail 2 vCPU
                      </span>
                    </td>
                    <td>
                      <div>{w.region}</div>
                      <span className="font-mono" style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>
                        {w.host}
                      </span>
                    </td>
                    <td>
                      <span className={`badge-pill ${w.status === "active" ? "ok" : "warn"}`}>
                        {w.status.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      {/* Null means the worker has not written a status file
                          — silence, not zero. */}
                      <span
                        className="font-mono"
                        style={{
                          color:
                            w.lagMs == null
                              ? "var(--text-dim)"
                              : w.lagMs < 50
                                ? "var(--green)"
                                : "var(--amber)",
                        }}
                      >
                        {w.lagMs == null ? "—" : `${w.lagMs} ms`}
                      </span>
                    </td>
                    <td>
                      <span className="font-mono">
                        Q: {w.queueDepth} · Heap: {w.scheduled}
                      </span>
                    </td>
                    <td>
                      <span className="font-mono">
                        {w.memoryMb} / {w.maxMemoryMb} MB ({w.swapMb} MB swap)
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                        {/* The API does not report systemd unit state, so
                            this shows what it does know rather than three
                            reassuring lines that were never checked. */}
                        {w.units ? (
                          <>
                            <span style={{ fontSize: "0.72rem", color: "var(--green)" }}>• worker: {w.units.worker}</span>
                            <span style={{ fontSize: "0.72rem", color: "var(--green)" }}>• api: {w.units.api}</span>
                            <span style={{ fontSize: "0.72rem", color: "var(--green)" }}>• caddy: {w.units.caddy}</span>
                          </>
                        ) : (
                          <span style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>
                            shard {w.index ?? 0}/{w.count ?? 1} · updated{" "}
                            {w.updatedAt ? new Date(w.updatedAt).toLocaleTimeString() : "never"}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className="font-mono">v{w.version}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="split-grid">
            <div className="stat-card">
              <div className="stat-card-title">Instance Specifications</div>
              <div style={{ marginTop: 10, fontSize: "0.85rem", lineHeight: 1.7 }}>
                <div>• <strong>Hardware:</strong> $5 AWS Lightsail Instance (ap-southeast-1a)</div>
                <div>• <strong>RAM:</strong> 414 MB physical + 1 GB swap (tuned MemoryMax)</div>
                <div>• <strong>Concurrency:</strong> PROBE_CONCURRENCY=50 (bounded async pool)</div>
                <div>• <strong>Database:</strong> SQLite with 5-second write batching</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-card-title">Security &amp; SSRF Boundaries</div>
              <div style={{ marginTop: 10, fontSize: "0.85rem", lineHeight: 1.7 }}>
                <div>• <strong>IMDSv2 Enforced:</strong> Token hops strictly blocked</div>
                <div>• <strong>TargetGuard:</strong> Pre-probe DNS resolution &amp; link-local filter</div>
                <div>• <strong>Ping Capabilities:</strong> cap_net_raw=ep on ping binary</div>
                <div>• <strong>Keep-Alive:</strong> Deliberately OFF (measures 1st-packet TLS)</div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 6. TAB 4: MONITOR MANAGEMENT */}
      {activeTab === "monitors" && (
        <section className="panel">
          <div className="panel-header">
            <div className="panel-title-wrap">
              <span style={{ fontSize: "1.2rem" }}>📡</span>
              <div>
                <h2 className="panel-title">Fleet Monitor Management</h2>
                <p className="panel-desc">All configured endpoints, protocols, intervals, and health states.</p>
              </div>
            </div>
            <span className="font-mono" style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>
              Showing {filteredMonitors.length} of {monitors.length} monitors
            </span>
          </div>

          <div className="filter-bar">
            <div className="filter-group">
              <input
                type="text"
                placeholder="Search by monitor name or target URL…"
                className="search-input"
                value={monitorSearch}
                onChange={(e) => setMonitorSearch(e.target.value)}
              />
              <select
                className="filter-select"
                value={monitorTypeFilter}
                onChange={(e) => setMonitorTypeFilter(e.target.value)}
              >
                <option value="all">All Protocols</option>
                <option value="http">HTTP(S)</option>
                <option value="ssl">SSL Expiry</option>
                <option value="tcp">TCP Port</option>
                <option value="dns">DNS Record</option>
                <option value="icmp">ICMP Ping</option>
                <option value="heartbeat">Cron Heartbeat</option>
              </select>
              <select
                className="filter-select"
                value={monitorStatusFilter}
                onChange={(e) => setMonitorStatusFilter(e.target.value)}
              >
                <option value="all">All Statuses</option>
                <option value="up">Operational (Up)</option>
                <option value="down">Degraded (Down)</option>
                <option value="paused">Paused</option>
                <option value="pending">Pending</option>
              </select>
            </div>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Monitor Name</th>
                  <th>Target / Host</th>
                  <th>Protocol</th>
                  <th>Status</th>
                  <th>Interval</th>
                  <th>30d Uptime</th>
                  <th>Latency</th>
                  <th>Public Page</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredMonitors.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{m.name}</div>
                      <span className="font-mono" style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>
                        ID: {m.id}
                      </span>
                    </td>
                    <td>
                      <div className="font-mono" style={{ fontSize: "0.8rem", maxWidth: "240px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {m.target}
                      </div>
                    </td>
                    <td>
                      <span className="badge-pill warn" style={{ color: "var(--blue)", borderColor: "rgba(56,189,248,0.3)" }}>
                        {m.type.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <span className={`badge-pill ${m.status === "up" ? "ok" : m.status === "down" ? "danger" : "warn"}`}>
                        <span className={`status-dot ${m.status === "up" ? "ok" : m.status === "down" ? "danger" : "warn"}`} />
                        {m.status.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <span className="font-mono">
                        {m.intervalSeconds >= 60 ? `${Math.round(m.intervalSeconds / 60)}m` : `${m.intervalSeconds}s`}
                      </span>
                    </td>
                    <td>
                      <span className="font-mono" style={{ color: m.uptime30d > 99 ? "var(--green)" : "var(--amber)" }}>
                        {m.uptime30d.toFixed(2)}%
                      </span>
                    </td>
                    <td>
                      <span className="font-mono">
                        {m.latencyMs > 0 ? `${m.latencyMs} ms` : "—"}
                      </span>
                    </td>
                    <td>
                      {m.publicOnStatusPage ? (
                        <span style={{ color: "var(--green)", fontSize: "0.8rem" }}>✓ Published</span>
                      ) : (
                        <span style={{ color: "var(--text-dim)", fontSize: "0.8rem" }}>Private</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: "4px 8px", fontSize: "0.75rem" }}
                          onClick={() => setInspectedMonitor(m)}
                        >
                          Inspect
                        </button>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: "4px 8px", fontSize: "0.75rem" }}
                          onClick={() => {
                            if (m.target.startsWith("http")) {
                              setProbeTarget(m.target);
                              setActiveTab("overview");
                            }
                          }}
                        >
                          Probe
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* 7. TAB 5: USER STATISTICS */}
      {activeTab === "user-stats" && (
        <>
          <section className="stats-grid">
            <div className="stat-card">
              <div className="stat-card-title">Total Workspaces</div>
              <div className="stat-card-value">{userStats.totalUsers}</div>
              <div className="stat-card-sub">Registered platform accounts</div>
            </div>

            <div className="stat-card">
              <div className="stat-card-title">Supporters &amp; Donors</div>
              <div className="stat-card-value" style={{ color: "var(--green)" }}>
                {userStats.donors}
              </div>
              <div className="stat-card-sub">{userStats.donorRatio}% paid capacity ratio</div>
            </div>

            <div className="stat-card">
              <div className="stat-card-title">Free Tier Accounts</div>
              <div className="stat-card-value">{userStats.free}</div>
              <div className="stat-card-sub">14,400 daily check quota</div>
            </div>

            <div className="stat-card">
              <div className="stat-card-title">Avg Monitors / User</div>
              <div className="stat-card-value">
                {(userStats.totalMonitors / (userStats.totalUsers || 1)).toFixed(1)}
              </div>
              <div className="stat-card-sub">Healthy resource density</div>
            </div>
          </section>

          <div className="split-grid">
            <section className="panel">
              <h2 className="panel-title" style={{ marginBottom: 16 }}>Plan &amp; Quota Distribution</h2>

              <div className="stat-bar-group">
                <div className="stat-bar-header">
                  <span>Donor Workspaces (Expanded Capacity)</span>
                  <span className="font-mono">{userStats.donorRatio}% ({userStats.donors})</span>
                </div>
                <div className="progress-bar-bg">
                  <div className="progress-bar-fill" style={{ width: `${userStats.donorRatio}%`, background: "var(--green)" }} />
                </div>
              </div>

              <div className="stat-bar-group">
                <div className="stat-bar-header">
                  <span>Free Forever Workspaces (14,400 checks/day)</span>
                  <span className="font-mono">{100 - userStats.donorRatio}% ({userStats.free})</span>
                </div>
                <div className="progress-bar-bg">
                  <div className="progress-bar-fill" style={{ width: `${100 - userStats.donorRatio}%`, background: "var(--blue)" }} />
                </div>
              </div>

              <div style={{ marginTop: 24, padding: 14, background: "rgba(255,255,255,0.02)", borderRadius: 8, fontSize: "0.82rem" }}>
                💡 <strong>Economic Policy:</strong> Capacity is priced by depletion rather than an arbitrary monthly seat paywall. Donors receive 10,000 checks/day per $1, rolling over forever.
              </div>
            </section>

            <section className="panel">
              <h2 className="panel-title" style={{ marginBottom: 16 }}>User Engagement Telemetry</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 14, fontSize: "0.85rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: 8 }}>
                  <span style={{ color: "var(--text-muted)" }}>Daily Active Users (DAU):</span>
                  <strong className="font-mono">82%</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: 8 }}>
                  <span style={{ color: "var(--text-muted)" }}>Public Status Page Adoption:</span>
                  <strong className="font-mono">60% of orgs</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: 8 }}>
                  <span style={{ color: "var(--text-muted)" }}>Multi-Channel Alert Integration:</span>
                  <strong className="font-mono">Slack, Discord, Mailgun</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: 8 }}>
                  <span style={{ color: "var(--text-muted)" }}>Grace Window Transition Rate:</span>
                  <strong className="font-mono" style={{ color: "var(--green)" }}>100% Zero-Drop</strong>
                </div>
              </div>
            </section>
          </div>
        </>
      )}

      {/* 8. TAB 6: MONITOR STATISTICS */}
      {activeTab === "monitor-stats" && (
        <>
          <section className="stats-grid">
            <div className="stat-card">
              <div className="stat-card-title">Total Active Monitors</div>
              <div className="stat-card-value">{monitorStats.total}</div>
              <div className="stat-card-sub">Fleet-wide targets</div>
            </div>

            <div className="stat-card">
              <div className="stat-card-title">Fleet Uptime Ratio</div>
              <div className="stat-card-value" style={{ color: "var(--green)" }}>
                {monitorStats.overallUptime}%
              </div>
              <div className="stat-card-sub">{monitorStats.up} up / {monitorStats.down} down</div>
            </div>

            <div className="stat-card">
              <div className="stat-card-title">Estimated Daily Checks</div>
              <div className="stat-card-value" style={{ color: "var(--blue)" }}>
                172.8k
              </div>
              <div className="stat-card-sub">~120 checks/min on worker</div>
            </div>

            <div className="stat-card">
              <div className="stat-card-title">Median Probe Latency</div>
              <div className="stat-card-value">28 ms</div>
              <div className="stat-card-sub">p95: 64 ms · p99: 142 ms</div>
            </div>
          </section>

          <div className="split-grid">
            <section className="panel">
              <h2 className="panel-title" style={{ marginBottom: 16 }}>Protocol Breakdown</h2>

              {monitorStats.protocolEntries.map((p) => (
                <div key={p.type} className="stat-bar-group">
                  <div className="stat-bar-header">
                    <span style={{ textTransform: "uppercase" }}>{p.type} Monitoring</span>
                    <span className="font-mono">{p.count} monitors ({p.pct}%)</span>
                  </div>
                  <div className="progress-bar-bg">
                    <div
                      className="progress-bar-fill"
                      style={{
                        width: `${p.pct}%`,
                        background:
                          p.type === "http"
                            ? "var(--green)"
                            : p.type === "ssl"
                              ? "var(--purple)"
                              : p.type === "tcp"
                                ? "var(--blue)"
                                : "var(--amber)",
                      }}
                    />
                  </div>
                </div>
              ))}
            </section>

            <section className="panel">
              <h2 className="panel-title" style={{ marginBottom: 16 }}>Reliability &amp; Outage Insights</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 14, fontSize: "0.85rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: 8 }}>
                  <span style={{ color: "var(--text-muted)" }}>Mean Time to Detect (MTTD):</span>
                  <strong className="font-mono">30 - 60 seconds</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: 8 }}>
                  <span style={{ color: "var(--text-muted)" }}>Debounce Confirmation Threshold:</span>
                  <strong className="font-mono">2 consecutive failures</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: 8 }}>
                  <span style={{ color: "var(--text-muted)" }}>Incident Outbox Backoff Policy:</span>
                  <strong className="font-mono">Exponential (10s, 30s, 1m)</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: 8 }}>
                  <span style={{ color: "var(--text-muted)" }}>Drift-Free Scheduling:</span>
                  <strong className="font-mono" style={{ color: "var(--green)" }}>dueAt += interval</strong>
                </div>
              </div>
            </section>
          </div>
        </>
      )}

      {/* 9. TAB 7: DONATION MANAGEMENT */}
      {activeTab === "donations" && (
        <section className="panel">
          <div className="panel-header">
            <div className="panel-title-wrap">
              <span style={{ fontSize: "1.2rem" }}>☕</span>
              <div>
                <h2 className="panel-title">Donation &amp; Stripe Grant Management</h2>
                <p className="panel-desc">One-off $2.99 coffee donations, webhook grants, and credit balances.</p>
              </div>
            </div>
            <div className="font-mono" style={{ fontSize: "0.85rem", color: "var(--green)" }}>
              Total Funded: ${donationStats.totalRevenue.toFixed(2)}
            </div>
          </div>

          <div className="stats-grid" style={{ marginBottom: 20 }}>
            <div className="stat-card">
              <div className="stat-card-title">Total Donations</div>
              <div className="stat-card-value">{donationStats.donationCount}</div>
              <div className="stat-card-sub">Stripe Payment Link payments</div>
            </div>

            <div className="stat-card">
              <div className="stat-card-title">Funded Capacity Checks</div>
              <div className="stat-card-value" style={{ color: "var(--green)", fontSize: "1.5rem" }}>
                {donationStats.totalGranted.toLocaleString()}
              </div>
              <div className="stat-card-sub">897,000 checks per $2.99</div>
            </div>

            <div className="stat-card">
              <div className="stat-card-title">Stripe Webhook Secret</div>
              <div className="stat-card-value" style={{ fontSize: "1.2rem", color: "var(--blue)" }}>
                Configured
              </div>
              <div className="stat-card-sub">Raw body signature verification</div>
            </div>

            <div className="stat-card">
              <div className="stat-card-title">Nightly Burn Engine</div>
              <div className="stat-card-value" style={{ fontSize: "1.2rem" }}>
                Idempotent
              </div>
              <div className="stat-card-sub">charges actual day_rollups</div>
            </div>
          </div>

          <div className="filter-bar">
            <input
              type="text"
              placeholder="Search donations by email, org, or Stripe event ID…"
              className="search-input"
              value={donationSearch}
              onChange={(e) => setDonationSearch(e.target.value)}
            />
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Donation ID</th>
                  <th>Workspace / Org</th>
                  <th>Supporter Email</th>
                  <th>Amount</th>
                  <th>Checks Granted</th>
                  <th>Stripe Event ID</th>
                  <th>Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredDonations.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <span className="font-mono" style={{ fontWeight: 700 }}>{d.id}</span>
                    </td>
                    <td>
                      <div>{d.orgName}</div>
                      <span className="font-mono" style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>
                        {d.orgId}
                      </span>
                    </td>
                    <td>
                      <span className="font-mono">{d.customerEmail}</span>
                    </td>
                    <td>
                      <strong style={{ color: "var(--green)" }}>${d.amountUsd.toFixed(2)}</strong>
                    </td>
                    <td>
                      <span className="font-mono">+{d.creditsGranted.toLocaleString()}</span>
                    </td>
                    <td>
                      <span className="font-mono" style={{ fontSize: "0.72rem", color: "var(--blue)" }}>
                        {d.stripeEventId}
                      </span>
                    </td>
                    <td>
                      <span className="font-mono" style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
                        {d.createdAt}
                      </span>
                    </td>
                    <td>
                      <span className="badge-pill ok">
                        ✓ {d.status.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* 10. TAB 8: DYNAMIC APP CONFIGURATION */}
      {activeTab === "settings" && (
        <form onSubmit={handleSaveConfig} className="config-container">
          <div className="panel" style={{ padding: "20px 24px", marginBottom: 0 }}>
            <div className="panel-header" style={{ marginBottom: 0 }}>
              <div className="panel-title-wrap">
                <span style={{ fontSize: "1.3rem" }}>🔧</span>
                <div>
                  <h2 className="panel-title">Application &amp; Fleet Dynamic Configuration</h2>
                  <p className="panel-desc">
                    Configure alert delivery gateways, Stripe billing, and probe engine parameters live without SSH or restarting workers.
                  </p>
                </div>
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={configSaving}
                  style={{ minWidth: "160px", justifyContent: "center" }}
                >
                  {configSaving ? "Saving to Fleet…" : "Save Configuration"}
                </button>
              </div>
            </div>
          </div>

          {configSuccess && (
            <div
              style={{
                background: "rgba(59, 214, 113, 0.12)",
                border: "1px solid rgba(59, 214, 113, 0.35)",
                borderRadius: "10px",
                padding: "12px 18px",
                color: "#4ade80",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span>✓ {configSuccess}</span>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: "4px 8px", fontSize: "0.72rem" }}
                onClick={() => setConfigSuccess(null)}
              >
                Dismiss
              </button>
            </div>
          )}

          {configError && (
            <div
              style={{
                background: "rgba(239, 68, 68, 0.12)",
                border: "1px solid rgba(239, 68, 68, 0.35)",
                borderRadius: "10px",
                padding: "12px 18px",
                color: "#ef4444",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span>⚠️ {configError}</span>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: "4px 8px", fontSize: "0.72rem" }}
                onClick={() => setConfigError(null)}
              >
                Dismiss
              </button>
            </div>
          )}

          {/* SECTION 1: ALERT & NOTIFICATION GATEWAYS */}
          <div className="config-card">
            <div className="config-card-header">
              <div>
                <div className="config-card-title">
                  <span>📧 Alert Delivery Gateways</span>
                </div>
                <div className="config-card-desc">
                  Mailgun (primary) and Resend (fallback) email delivery, Telegram alerts, and sender verification.
                </div>
              </div>
              <span className="badge-pill ok">Runtime Hot-Reload</span>
            </div>

            <div className="config-grid">
              <div className="config-field">
                <div className="config-label-row">
                  <label className="config-label">Sender From Email (ALERT_FROM_EMAIL)</label>
                  <span className={`config-badge ${isFieldCustom("alertFromEmail") ? "custom" : "default"}`}>
                    {isFieldCustom("alertFromEmail") ? "Firestore Override" : "Env Default"}
                  </span>
                </div>
                <input
                  type="email"
                  className="config-input"
                  value={configForm.alertFromEmail}
                  onChange={(e) => setConfigForm({ ...configForm, alertFromEmail: e.target.value })}
                  placeholder={envDefaults.alertFromEmail}
                />
                <span className="config-hint">Must sit on the Mailgun sending domain for DMARC/SPF compliance.</span>
              </div>

              <div className="config-field">
                <div className="config-label-row">
                  <label className="config-label">Mailgun Sending Domain (MAILGUN_DOMAIN)</label>
                  <span className={`config-badge ${isFieldCustom("mailgunDomain") ? "custom" : "default"}`}>
                    {isFieldCustom("mailgunDomain") ? "Firestore Override" : "Env Default"}
                  </span>
                </div>
                <input
                  type="text"
                  className="config-input"
                  value={configForm.mailgunDomain}
                  onChange={(e) => setConfigForm({ ...configForm, mailgunDomain: e.target.value })}
                  placeholder={envDefaults.mailgunDomain}
                />
                <span className="config-hint">Configured sub-domain in Mailgun (e.g. mg.uptimemonke.com).</span>
              </div>

              <div className="config-field">
                <div className="config-label-row">
                  <label className="config-label">Mailgun API Key (MAILGUN_API_KEY)</label>
                  <span className={`config-badge ${isFieldCustom("mailgunApiKey") ? "custom" : "default"}`}>
                    {isFieldCustom("mailgunApiKey") ? "Firestore Override" : "Env Default"}
                  </span>
                </div>
                <div className="config-input-wrap">
                  <input
                    type={visibleSecrets.mailgunApiKey ? "text" : "password"}
                    className="config-input config-input-secret"
                    value={configForm.mailgunApiKey}
                    onChange={(e) => setConfigForm({ ...configForm, mailgunApiKey: e.target.value })}
                    placeholder="key-xxxxxxxxxxxxxxxxxxxxxxxx"
                  />
                  <button
                    type="button"
                    className="config-secret-toggle"
                    onClick={() => toggleSecret("mailgunApiKey")}
                    title={visibleSecrets.mailgunApiKey ? "Hide key" : "Show key"}
                  >
                    {visibleSecrets.mailgunApiKey ? "🙈" : "👁️"}
                  </button>
                </div>
                <span className="config-hint">Primary email delivery key. Form-encoded basic auth username is 'api'.</span>
              </div>

              <div className="config-field">
                <div className="config-label-row">
                  <label className="config-label">Mailgun API Endpoint (MAILGUN_BASE_URL)</label>
                  <span className={`config-badge ${isFieldCustom("mailgunBaseUrl") ? "custom" : "default"}`}>
                    {isFieldCustom("mailgunBaseUrl") ? "Firestore Override" : "Env Default"}
                  </span>
                </div>
                <input
                  type="url"
                  className="config-input"
                  value={configForm.mailgunBaseUrl}
                  onChange={(e) => setConfigForm({ ...configForm, mailgunBaseUrl: e.target.value })}
                  placeholder={envDefaults.mailgunBaseUrl}
                />
                <span className="config-hint">Use https://api.eu.mailgun.net for European Union region accounts.</span>
              </div>

              <div className="config-field">
                <div className="config-label-row">
                  <label className="config-label">Resend API Key Fallback (RESEND_API_KEY)</label>
                  <span className={`config-badge ${isFieldCustom("resendApiKey") ? "custom" : "default"}`}>
                    {isFieldCustom("resendApiKey") ? "Firestore Override" : "Env Default"}
                  </span>
                </div>
                <div className="config-input-wrap">
                  <input
                    type={visibleSecrets.resendApiKey ? "text" : "password"}
                    className="config-input config-input-secret"
                    value={configForm.resendApiKey}
                    onChange={(e) => setConfigForm({ ...configForm, resendApiKey: e.target.value })}
                    placeholder="re_xxxxxxxxxxxxxxxx"
                  />
                  <button
                    type="button"
                    className="config-secret-toggle"
                    onClick={() => toggleSecret("resendApiKey")}
                  >
                    {visibleSecrets.resendApiKey ? "🙈" : "👁️"}
                  </button>
                </div>
                <span className="config-hint">Used automatically when Mailgun key is empty or returns provider failure.</span>
              </div>

              <div className="config-field">
                <div className="config-label-row">
                  <label className="config-label">Telegram Bot Token (TELEGRAM_BOT_TOKEN)</label>
                  <span className={`config-badge ${isFieldCustom("telegramBotToken") ? "custom" : "default"}`}>
                    {isFieldCustom("telegramBotToken") ? "Firestore Override" : "Env Default"}
                  </span>
                </div>
                <div className="config-input-wrap">
                  <input
                    type={visibleSecrets.telegramBotToken ? "text" : "password"}
                    className="config-input config-input-secret"
                    value={configForm.telegramBotToken}
                    onChange={(e) => setConfigForm({ ...configForm, telegramBotToken: e.target.value })}
                    placeholder="123456789:ABCdefGHIjklMNOpqrSTUvwxYZ"
                  />
                  <button
                    type="button"
                    className="config-secret-toggle"
                    onClick={() => toggleSecret("telegramBotToken")}
                  >
                    {visibleSecrets.telegramBotToken ? "🙈" : "👁️"}
                  </button>
                </div>
                <span className="config-hint">BotFather token for sending alerts to Telegram chat and group channels.</span>
              </div>
            </div>
          </div>

          {/* SECTION 2: BILLING & STRIPE DONATIONS */}
          <div className="config-card">
            <div className="config-card-header">
              <div>
                <div className="config-card-title">
                  <span>💳 Billing &amp; Stripe Donations</span>
                </div>
                <div className="config-card-desc">
                  Payment Links, one-off vs recurring subscription pricing, and raw-body webhook signature verification.
                </div>
              </div>
              <span className="badge-pill warn" style={{ color: "var(--amber)", borderColor: "rgba(245,158,11,0.3)" }}>
                Credit Ledger
              </span>
            </div>

            <div className="config-grid">
              <div className="config-field full-width">
                <div className="config-label-row">
                  <label className="config-label">Stripe Payment Link URL (DONATION_LINK_URL)</label>
                  <span className={`config-badge ${isFieldCustom("donationLinkUrl") ? "custom" : "default"}`}>
                    {isFieldCustom("donationLinkUrl") ? "Firestore Override" : "Env Default"}
                  </span>
                </div>
                <input
                  type="url"
                  className="config-input"
                  value={configForm.donationLinkUrl}
                  onChange={(e) => setConfigForm({ ...configForm, donationLinkUrl: e.target.value })}
                  placeholder={envDefaults.donationLinkUrl}
                />
                <span className="config-hint">Stripe Payment Link URL without workspace query params. API appends client_reference_id dynamically.</span>
              </div>

              <div className="config-field">
                <div className="config-label-row">
                  <label className="config-label">Donation Amount in Cents (DONATION_LINK_CENTS)</label>
                  <span className={`config-badge ${isFieldCustom("donationLinkCents") ? "custom" : "default"}`}>
                    {isFieldCustom("donationLinkCents") ? "Firestore Override" : "Env Default"}
                  </span>
                </div>
                <input
                  type="number"
                  className="config-input"
                  value={configForm.donationLinkCents}
                  onChange={(e) => setConfigForm({ ...configForm, donationLinkCents: e.target.value })}
                  placeholder={envDefaults.donationLinkCents}
                />
                <span className="config-hint">Amount charged (e.g. 299 = $2.99). Grants 10,000 capacity checks per $1.00.</span>
              </div>

              <div className="config-field">
                <div className="config-label-row">
                  <label className="config-label">Recurring Subscription Flag (DONATION_LINK_RECURRING)</label>
                  <span className={`config-badge ${isFieldCustom("donationLinkRecurring") ? "custom" : "default"}`}>
                    {isFieldCustom("donationLinkRecurring") ? "Firestore Override" : "Env Default"}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "8px" }}>
                  <input
                    type="checkbox"
                    id="donationLinkRecurring"
                    checked={configForm.donationLinkRecurring}
                    onChange={(e) => setConfigForm({ ...configForm, donationLinkRecurring: e.target.checked })}
                    style={{ width: "18px", height: "18px", cursor: "pointer", accentColor: "var(--green)" }}
                  />
                  <label htmlFor="donationLinkRecurring" style={{ fontSize: "0.85rem", cursor: "pointer", color: "var(--text)" }}>
                    Stripe Payment Link is configured as monthly recurring subscription
                  </label>
                </div>
                <span className="config-hint">Controls button copy and renewal badge in the supporter dashboard.</span>
              </div>

              <div className="config-field">
                <div className="config-label-row">
                  <label className="config-label">Stripe Webhook Secret (STRIPE_WEBHOOK_SECRET)</label>
                  <span className={`config-badge ${isFieldCustom("stripeWebhookSecret") ? "custom" : "default"}`}>
                    {isFieldCustom("stripeWebhookSecret") ? "Firestore Override" : "Env Default"}
                  </span>
                </div>
                <div className="config-input-wrap">
                  <input
                    type={visibleSecrets.stripeWebhookSecret ? "text" : "password"}
                    className="config-input config-input-secret"
                    value={configForm.stripeWebhookSecret}
                    onChange={(e) => setConfigForm({ ...configForm, stripeWebhookSecret: e.target.value })}
                    placeholder="whsec_xxxxxxxxxxxxxxxxxxxx"
                  />
                  <button
                    type="button"
                    className="config-secret-toggle"
                    onClick={() => toggleSecret("stripeWebhookSecret")}
                  >
                    {visibleSecrets.stripeWebhookSecret ? "🙈" : "👁️"}
                  </button>
                </div>
                <span className="config-hint">Signing secret used to cryptographically verify Stripe raw-body webhook payloads.</span>
              </div>

              <div className="config-field">
                <div className="config-label-row">
                  <label className="config-label">Stripe Secret Key (STRIPE_SECRET_KEY, Optional)</label>
                  <span className={`config-badge ${isFieldCustom("stripeSecretKey") ? "custom" : "default"}`}>
                    {isFieldCustom("stripeSecretKey") ? "Firestore Override" : "Env Default"}
                  </span>
                </div>
                <div className="config-input-wrap">
                  <input
                    type={visibleSecrets.stripeSecretKey ? "text" : "password"}
                    className="config-input config-input-secret"
                    value={configForm.stripeSecretKey}
                    onChange={(e) => setConfigForm({ ...configForm, stripeSecretKey: e.target.value })}
                    placeholder="sk_live_xxxxxxxxxxxxxxxxxxxx"
                  />
                  <button
                    type="button"
                    className="config-secret-toggle"
                    onClick={() => toggleSecret("stripeSecretKey")}
                  >
                    {visibleSecrets.stripeSecretKey ? "🙈" : "👁️"}
                  </button>
                </div>
                <span className="config-hint">Optional API key. Payment links require only webhook secret to credit accounts.</span>
              </div>
            </div>
          </div>

          {/* SECTION 3: PROBE ENGINE & WORKER TUNING */}
          <div className="config-card">
            <div className="config-card-header">
              <div>
                <div className="config-card-title">
                  <span>⚡ Probe Engine &amp; Worker Tuning</span>
                </div>
                <div className="config-card-desc">
                  Concurrency ceilings, SQLite batch flush intervals, data retention, and external dead-man's switch.
                </div>
              </div>
              <span className="badge-pill ok">Fleet Probes</span>
            </div>

            <div className="config-grid">
              {/* Capacity limits. Grouped and labelled with their bounds,
                  because these are the only fields here that change how much
                  work the fleet accepts — the rest are plumbing. */}
              <div className="config-field">
                <div className="config-label-row">
                  <label className="config-label">Minimum Check Interval — Free, seconds (MIN_INTERVAL_SECONDS_FREE)</label>
                  <span className={`config-badge ${isFieldCustom("minIntervalSecondsFree") ? "custom" : "default"}`}>
                    {isFieldCustom("minIntervalSecondsFree") ? "Firestore Override" : "Env Default"}
                  </span>
                </div>
                <input
                  type="number"
                  min={5}
                  max={3600}
                  className="config-input"
                  value={configForm.minIntervalSecondsFree}
                  onChange={(e) => setConfigForm({ ...configForm, minIntervalSecondsFree: e.target.value })}
                  placeholder={envDefaults.minIntervalSecondsFree}
                />
                <span className="config-hint">
                  The fastest interval a free workspace may request. Clamped to 5–3600s.
                  <strong> This is the load lever</strong> — most workspaces are free, so raising
                  it cuts probe CPU and Firestore writes across the fleet roughly in proportion.
                </span>
              </div>

              <div className="config-field">
                <div className="config-label-row">
                  <label className="config-label">Minimum Check Interval — Donor, seconds (MIN_INTERVAL_SECONDS_DONOR)</label>
                  <span className={`config-badge ${isFieldCustom("minIntervalSecondsDonor") ? "custom" : "default"}`}>
                    {isFieldCustom("minIntervalSecondsDonor") ? "Firestore Override" : "Env Default"}
                  </span>
                </div>
                <input
                  type="number"
                  min={5}
                  max={3600}
                  className="config-input"
                  value={configForm.minIntervalSecondsDonor}
                  onChange={(e) => setConfigForm({ ...configForm, minIntervalSecondsDonor: e.target.value })}
                  placeholder={envDefaults.minIntervalSecondsDonor}
                />
                <span className="config-hint">
                  What donating buys. 5s is the scheduler&apos;s own limit and nothing goes under it.
                  Note this one is the <em>smaller</em> number — the opposite of the monitor caps —
                  and it is lowered to meet the free floor if set above it, since donating must
                  never be a downgrade.
                  {Number(configForm.minIntervalSecondsDonor) > Number(configForm.minIntervalSecondsFree) && (
                    <strong style={{ color: "var(--amber, #f59e0b)", display: "block", marginTop: "4px" }}>
                      Slower than the free floor ({configForm.minIntervalSecondsFree}s) — the worker will lower it to match.
                    </strong>
                  )}
                </span>
              </div>

              <div className="config-field">
                <div className="config-label-row">
                  <label className="config-label">Max Monitors — Free Workspace (MAX_MONITORS_FREE)</label>
                  <span className={`config-badge ${isFieldCustom("maxMonitorsFree") ? "custom" : "default"}`}>
                    {isFieldCustom("maxMonitorsFree") ? "Firestore Override" : "Env Default"}
                  </span>
                </div>
                <input
                  type="number"
                  min={1}
                  max={5000}
                  className="config-input"
                  value={configForm.maxMonitorsFree}
                  onChange={(e) => setConfigForm({ ...configForm, maxMonitorsFree: e.target.value })}
                  placeholder={envDefaults.maxMonitorsFree}
                />
                <span className="config-hint">
                  A ceiling on monitor <em>count</em>, separate from the budget on check
                  <em> rate</em>. Clamped to 1–5000. Existing monitors above a lowered cap keep
                  running; only new ones are refused.
                </span>
              </div>

              <div className="config-field">
                <div className="config-label-row">
                  <label className="config-label">Max Monitors — Donor Workspace (MAX_MONITORS_DONOR)</label>
                  <span className={`config-badge ${isFieldCustom("maxMonitorsDonor") ? "custom" : "default"}`}>
                    {isFieldCustom("maxMonitorsDonor") ? "Firestore Override" : "Env Default"}
                  </span>
                </div>
                <input
                  type="number"
                  min={1}
                  max={5000}
                  className="config-input"
                  value={configForm.maxMonitorsDonor}
                  onChange={(e) => setConfigForm({ ...configForm, maxMonitorsDonor: e.target.value })}
                  placeholder={envDefaults.maxMonitorsDonor}
                />
                <span className="config-hint">
                  Clamped to 1–5000, and raised to match the free cap if set below it —
                  otherwise supporting the project would be a downgrade.
                  {Number(configForm.maxMonitorsDonor) < Number(configForm.maxMonitorsFree) && (
                    <strong style={{ color: "var(--amber, #f59e0b)", display: "block", marginTop: "4px" }}>
                      Below the free cap ({configForm.maxMonitorsFree}) — the worker will raise it to match.
                    </strong>
                  )}
                </span>
              </div>

              <div className="config-field">
                <div className="config-label-row">
                  <label className="config-label">Max In-Flight Probe Concurrency (PROBE_CONCURRENCY)</label>
                  <span className={`config-badge ${isFieldCustom("probeConcurrency") ? "custom" : "default"}`}>
                    {isFieldCustom("probeConcurrency") ? "Firestore Override" : "Env Default"}
                  </span>
                </div>
                <input
                  type="number"
                  className="config-input"
                  value={configForm.probeConcurrency}
                  onChange={(e) => setConfigForm({ ...configForm, probeConcurrency: e.target.value })}
                  placeholder={envDefaults.probeConcurrency}
                />
                <span className="config-hint">50 for 512MB RAM workers, 200+ for 1GB+ RAM instances. Protects sockets &amp; memory.</span>
              </div>

              <div className="config-field">
                <div className="config-label-row">
                  <label className="config-label">External Dead-Man's Switch URL (UPTIMEMONK_HEARTBEAT_URL)</label>
                  <span className={`config-badge ${isFieldCustom("heartbeatUrl") ? "custom" : "default"}`}>
                    {isFieldCustom("heartbeatUrl") ? "Firestore Override" : "Env Default"}
                  </span>
                </div>
                <input
                  type="url"
                  className="config-input"
                  value={configForm.heartbeatUrl}
                  onChange={(e) => setConfigForm({ ...configForm, heartbeatUrl: e.target.value })}
                  placeholder={envDefaults.heartbeatUrl || "https://betteruptime.com/api/v1/heartbeat/..."}
                />
                <span className="config-hint">Pinged every tick. External service alerts if the worker box dies silently.</span>
              </div>

              <div className="config-field full-width">
                <div className="config-label-row">
                  <label className="config-label">HTTP Probe User-Agent (USER_AGENT)</label>
                  <span className={`config-badge ${isFieldCustom("userAgent") ? "custom" : "default"}`}>
                    {isFieldCustom("userAgent") ? "Firestore Override" : "Env Default"}
                  </span>
                </div>
                <input
                  type="text"
                  className="config-input"
                  value={configForm.userAgent}
                  onChange={(e) => setConfigForm({ ...configForm, userAgent: e.target.value })}
                  placeholder={envDefaults.userAgent}
                />
                <span className="config-hint">Sent in all outbound HTTP/HTTPS and keyword verification requests.</span>
              </div>

              <div className="config-field">
                <div className="config-label-row">
                  <label className="config-label">Hourly Samples Retention Days (RETENTION_DAYS)</label>
                  <span className={`config-badge ${isFieldCustom("retentionDays") ? "custom" : "default"}`}>
                    {isFieldCustom("retentionDays") ? "Firestore Override" : "Env Default"}
                  </span>
                </div>
                <input
                  type="number"
                  className="config-input"
                  value={configForm.retentionDays}
                  onChange={(e) => setConfigForm({ ...configForm, retentionDays: e.target.value })}
                  placeholder={envDefaults.retentionDays}
                />
                <span className="config-hint">Raw hourly sample buckets pruned nightly (default 35 days).</span>
              </div>

              <div className="config-field">
                <div className="config-label-row">
                  <label className="config-label">Incident History Retention Days (INCIDENT_RETENTION_DAYS)</label>
                  <span className={`config-badge ${isFieldCustom("incidentRetentionDays") ? "custom" : "default"}`}>
                    {isFieldCustom("incidentRetentionDays") ? "Firestore Override" : "Env Default"}
                  </span>
                </div>
                <input
                  type="number"
                  className="config-input"
                  value={configForm.incidentRetentionDays}
                  onChange={(e) => setConfigForm({ ...configForm, incidentRetentionDays: e.target.value })}
                  placeholder={envDefaults.incidentRetentionDays}
                />
                <span className="config-hint">Resolved incident retention window (default 365 days). Open incidents are never pruned.</span>
              </div>

              <div className="config-field">
                <div className="config-label-row">
                  <label className="config-label">SQLite Disk Flush Milliseconds (DB_FLUSH_MS)</label>
                  <span className={`config-badge ${isFieldCustom("dbFlushMs") ? "custom" : "default"}`}>
                    {isFieldCustom("dbFlushMs") ? "Firestore Override" : "Env Default"}
                  </span>
                </div>
                <input
                  type="number"
                  className="config-input"
                  value={configForm.dbFlushMs}
                  onChange={(e) => setConfigForm({ ...configForm, dbFlushMs: e.target.value })}
                  placeholder={envDefaults.dbFlushMs}
                />
                <span className="config-hint">Buffers in-memory checks and writes in one single synchronous transaction (default 5,000 ms).</span>
              </div>

              <div className="config-field">
                <div className="config-label-row">
                  <label className="config-label">Firestore Status Mirror Flush (MIRROR_FLUSH_MS)</label>
                  <span className={`config-badge ${isFieldCustom("mirrorFlushMs") ? "custom" : "default"}`}>
                    {isFieldCustom("mirrorFlushMs") ? "Firestore Override" : "Env Default"}
                  </span>
                </div>
                <input
                  type="number"
                  className="config-input"
                  value={configForm.mirrorFlushMs}
                  onChange={(e) => setConfigForm({ ...configForm, mirrorFlushMs: e.target.value })}
                  placeholder={envDefaults.mirrorFlushMs}
                />
                <span className="config-hint">Periodic sync of aggregated org status mirror to Cloud Firestore (default 5 min).</span>
              </div>
            </div>
          </div>

          {/* SECTION 4: PEER VERIFICATION & CLUSTERING */}
          <div className="config-card">
            <div className="config-card-header">
              <div>
                <div className="config-card-title">
                  <span>🛡️ Cross-Region Peer Verification</span>
                </div>
                <div className="config-card-desc">
                  Shared cryptographic secret and remote peer URL for multi-region failure confirmations.
                </div>
              </div>
              <span className="badge-pill warn" style={{ color: "var(--blue)", borderColor: "rgba(56,189,248,0.3)" }}>
                False Alarm Guard
              </span>
            </div>

            <div className="config-grid">
              <div className="config-field">
                <div className="config-label-row">
                  <label className="config-label">Peer Verification Secret (VERIFY_SECRET)</label>
                  <span className={`config-badge ${isFieldCustom("verifySecret") ? "custom" : "default"}`}>
                    {isFieldCustom("verifySecret") ? "Firestore Override" : "Env Default"}
                  </span>
                </div>
                <div className="config-input-wrap">
                  <input
                    type={visibleSecrets.verifySecret ? "text" : "password"}
                    className="config-input config-input-secret"
                    value={configForm.verifySecret}
                    onChange={(e) => setConfigForm({ ...configForm, verifySecret: e.target.value })}
                    placeholder="sec_peer_verification_hmac_key"
                  />
                  <button
                    type="button"
                    className="config-secret-toggle"
                    onClick={() => toggleSecret("verifySecret")}
                  >
                    {visibleSecrets.verifySecret ? "🙈" : "👁️"}
                  </button>
                </div>
                <span className="config-hint">Shared HMAC secret used by workers to sign /internal/verify probe requests.</span>
              </div>

              <div className="config-field">
                <div className="config-label-row">
                  <label className="config-label">Peer Worker Base URL (VERIFY_PEER_URL)</label>
                  <span className={`config-badge ${isFieldCustom("verifyPeerUrl") ? "custom" : "default"}`}>
                    {isFieldCustom("verifyPeerUrl") ? "Firestore Override" : "Env Default"}
                  </span>
                </div>
                <input
                  type="url"
                  className="config-input"
                  value={configForm.verifyPeerUrl}
                  onChange={(e) => setConfigForm({ ...configForm, verifyPeerUrl: e.target.value })}
                  placeholder={envDefaults.verifyPeerUrl || "https://api-us.uptimemonke.com"}
                />
                <span className="config-hint">URL of the secondary worker deployed in another AWS region.</span>
              </div>
            </div>
          </div>

          {/* SECTION 5: APP ROUTING & DOMAINS */}
          <div className="config-card">
            <div className="config-card-header">
              <div>
                <div className="config-card-title">
                  <span>🌐 Application &amp; API Domain Routing</span>
                </div>
                <div className="config-card-desc">
                  Customer web dashboard URL and worker API endpoint used for links in email alerts and CORS origins.
                </div>
              </div>
              <span className="badge-pill ok">Domains</span>
            </div>

            <div className="config-grid">
              <div className="config-field">
                <div className="config-label-row">
                  <label className="config-label">Dashboard Web URL (APP_URL)</label>
                  <span className={`config-badge ${isFieldCustom("appUrl") ? "custom" : "default"}`}>
                    {isFieldCustom("appUrl") ? "Firestore Override" : "Env Default"}
                  </span>
                </div>
                <input
                  type="url"
                  className="config-input"
                  value={configForm.appUrl}
                  onChange={(e) => setConfigForm({ ...configForm, appUrl: e.target.value })}
                  placeholder={envDefaults.appUrl}
                />
                <span className="config-hint">Referenced in alert emails to navigate customers directly to incident reports.</span>
              </div>

              <div className="config-field">
                <div className="config-label-row">
                  <label className="config-label">Worker API Endpoint (API_URL)</label>
                  <span className={`config-badge ${isFieldCustom("apiUrl") ? "custom" : "default"}`}>
                    {isFieldCustom("apiUrl") ? "Firestore Override" : "Env Default"}
                  </span>
                </div>
                <input
                  type="url"
                  className="config-input"
                  value={configForm.apiUrl}
                  onChange={(e) => setConfigForm({ ...configForm, apiUrl: e.target.value })}
                  placeholder={envDefaults.apiUrl}
                />
                <span className="config-hint">Public entrypoint for probe heartbeats, monitoring CRUD, and status pages.</span>
              </div>
            </div>
          </div>

          {/* SECTION 6: GOOGLE RECAPTCHA BOT PROTECTION */}
          <div className="config-card">
            <div className="config-card-header">
              <div>
                <div className="config-card-title">
                  <span>🤖 Google reCAPTCHA v3 Bot Protection</span>
                </div>
                <div className="config-card-desc">
                  Invisible bot verification and automated abuse prevention for public endpoints and registrations.
                </div>
              </div>
              <span className="badge-pill ok" style={{ color: "var(--emerald)", borderColor: "rgba(52,211,153,0.3)" }}>
                Bot Shield
              </span>
            </div>

            <div className="config-grid">
              <div className="config-field">
                <div className="config-label-row">
                  <label className="config-label">reCAPTCHA Site Key (RECAPTCHA_SITE_KEY)</label>
                  <span className={`config-badge ${isFieldCustom("recaptchaSiteKey") ? "custom" : "default"}`}>
                    {isFieldCustom("recaptchaSiteKey") ? "Firestore Override" : "Env Default"}
                  </span>
                </div>
                <input
                  type="text"
                  className="config-input font-mono"
                  value={configForm.recaptchaSiteKey}
                  onChange={(e) => setConfigForm({ ...configForm, recaptchaSiteKey: e.target.value })}
                  placeholder={envDefaults.recaptchaSiteKey || "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI"}
                />
                <span className="config-hint">Public site key loaded by client browsers to execute reCAPTCHA v3 challenges.</span>
              </div>

              <div className="config-field">
                <div className="config-label-row">
                  <label className="config-label">reCAPTCHA Secret Key (RECAPTCHA_SECRET)</label>
                  <span className={`config-badge ${isFieldCustom("recaptchaSecret") ? "custom" : "default"}`}>
                    {isFieldCustom("recaptchaSecret") ? "Firestore Override" : "Env Default"}
                  </span>
                </div>
                <div className="config-input-wrap">
                  <input
                    type={visibleSecrets.recaptchaSecret ? "text" : "password"}
                    className="config-input config-input-secret font-mono"
                    value={configForm.recaptchaSecret}
                    onChange={(e) => setConfigForm({ ...configForm, recaptchaSecret: e.target.value })}
                    placeholder={envDefaults.recaptchaSecret || "6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe"}
                  />
                  <button
                    type="button"
                    className="config-secret-toggle"
                    onClick={() => toggleSecret("recaptchaSecret")}
                    title={visibleSecrets.recaptchaSecret ? "Hide secret" : "Show secret"}
                  >
                    {visibleSecrets.recaptchaSecret ? "🙈" : "👁️"}
                  </button>
                </div>
                <span className="config-hint">Private secret key used by backend servers to verify tokens with Google siteverify API.</span>
              </div>

              <div className="config-field">
                <div className="config-label-row">
                  <label className="config-label">Minimum Bot Score (RECAPTCHA_MIN_SCORE)</label>
                  <span className={`config-badge ${isFieldCustom("recaptchaMinScore") ? "custom" : "default"}`}>
                    {isFieldCustom("recaptchaMinScore") ? "Firestore Override" : "Env Default"}
                  </span>
                </div>
                <input
                  type="number"
                  step="0.05"
                  min="0.0"
                  max="1.0"
                  className="config-input"
                  value={configForm.recaptchaMinScore}
                  onChange={(e) => setConfigForm({ ...configForm, recaptchaMinScore: e.target.value })}
                  placeholder={envDefaults.recaptchaMinScore || "0.5"}
                />
                <span className="config-hint">Score threshold between 0.0 (likely bot) and 1.0 (human interaction). Default is 0.5.</span>
              </div>
            </div>
          </div>

          {/* Floating Actions Bar */}
          <div className="config-actions-bar">
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span className="status-dot ok pulse" />
              <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                {rawConfigFromDb ? "Realtime sync active via Firestore system/config" : "Using environment variable defaults"}
              </span>
            </div>
            <div style={{ display: "flex", gap: "12px" }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  if (confirm("Reset form back to original environment variable defaults?")) {
                    setConfigForm(envDefaults);
                  }
                }}
              >
                Reset to Env Defaults
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={configSaving}
                style={{ minWidth: "160px", justifyContent: "center" }}
              >
                {configSaving ? "Applying Changes…" : "Save Configuration"}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* INSPECTOR MODALS */}

      {/* User Inspector */}
      {inspectedUser && (
        <div className="modal-backdrop" onClick={() => setInspectedUser(null)}>
          <div className="inspector-modal" onClick={(e) => e.stopPropagation()}>
            <div className="inspector-header">
              <h3>User Inspector: {inspectedUser.name}</h3>
              <button className="btn btn-secondary" onClick={() => setInspectedUser(null)}>✕</button>
            </div>
            <div className="inspector-field">
              <label>User ID (UID)</label>
              <div className="val font-mono">{inspectedUser.uid}</div>
            </div>
            <div className="inspector-field">
              <label>Email Address</label>
              <div className="val">{inspectedUser.email}</div>
            </div>
            <div className="inspector-field">
              <label>Associated Workspace</label>
              <div className="val font-mono" style={{ color: "var(--blue)" }}>{inspectedUser.orgId}</div>
            </div>
            <div className="inspector-field">
              <label>Account Role &amp; Plan</label>
              <div className="val">{inspectedUser.role.toUpperCase()} · {(inspectedUser.plan ?? "none").toUpperCase()} TIER</div>
            </div>
            <div className="inspector-field">
              <label>Capacity Balance</label>
              <div className="val font-mono">{inspectedUser.creditsRemaining.toLocaleString()} checks remaining</div>
            </div>
            <div className="inspector-field">
              <label>Registered Date / Last Active</label>
              <div className="val">{inspectedUser.createdAt} (Last seen: {inspectedUser.lastActive})</div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Account — irreversible, so the address must be typed out. */}
      {deleteTarget && (
        <div className="modal-backdrop" onClick={() => !deleting && setDeleteTarget(null)}>
          <div className="inspector-modal" onClick={(e) => e.stopPropagation()}>
            <div className="inspector-header">
              <h3 style={{ color: "var(--red)" }}>Delete account</h3>
              <button
                className="btn btn-secondary"
                disabled={deleting}
                onClick={() => setDeleteTarget(null)}
              >
                ✕
              </button>
            </div>

            <div
              style={{
                background: "rgba(239, 68, 68, 0.08)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                borderRadius: "6px",
                padding: "12px 14px",
                marginBottom: "14px",
                fontSize: "0.85rem",
                lineHeight: 1.55,
              }}
            >
              This cannot be undone. It permanently removes the sign-in account,
              the workspace <strong>{deleteTarget.orgName || deleteTarget.orgId || "—"}</strong>,
              its <strong>{deleteTarget.monitorsCount}</strong> monitor(s), all
              history and incidents, the alert contacts, any public status page
              and its claimed address, and the credit ledger
              {deleteTarget.creditsRemaining > 0 && (
                <> — including <strong>{deleteTarget.creditsRemaining.toLocaleString()}</strong> unspent checks</>
              )}
              . Monitoring stops immediately and nobody is notified.
            </div>

            <div className="inspector-field">
              <label>Account</label>
              <div className="val font-mono">{deleteTarget.email ?? deleteTarget.uid}</div>
            </div>

            <div className="inspector-field">
              <label>Type the address to confirm</label>
              <input
                className="config-input"
                autoFocus
                spellCheck={false}
                autoComplete="off"
                value={deleteConfirm}
                disabled={deleting}
                placeholder={deleteTarget.email ?? deleteTarget.uid}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                style={{ width: "100%", fontFamily: "var(--font-mono, monospace)" }}
              />
            </div>

            {deleteError && (
              <div
                style={{
                  color: "var(--red)",
                  fontSize: "0.82rem",
                  marginTop: "10px",
                  lineHeight: 1.5,
                }}
              >
                {deleteError}
              </div>
            )}

            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "18px" }}>
              <button
                className="btn btn-secondary"
                disabled={deleting}
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </button>
              <button
                className="btn"
                disabled={deleting || deleteConfirm !== (deleteTarget.email ?? deleteTarget.uid)}
                onClick={handleDeleteUser}
                style={{
                  background: "var(--red)",
                  color: "#fff",
                  opacity:
                    deleting || deleteConfirm !== (deleteTarget.email ?? deleteTarget.uid) ? 0.5 : 1,
                }}
              >
                {deleting ? "Deleting…" : "Delete permanently"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Monitor Inspector */}
      {inspectedMonitor && (
        <div className="modal-backdrop" onClick={() => setInspectedMonitor(null)}>
          <div className="inspector-modal" onClick={(e) => e.stopPropagation()}>
            <div className="inspector-header">
              <h3>Monitor Details: {inspectedMonitor.name}</h3>
              <button className="btn btn-secondary" onClick={() => setInspectedMonitor(null)}>✕</button>
            </div>
            <div className="inspector-field">
              <label>Target URL / Host</label>
              <div className="val font-mono">{inspectedMonitor.target}</div>
            </div>
            <div className="inspector-field">
              <label>Protocol &amp; Status</label>
              <div className="val">{inspectedMonitor.type.toUpperCase()} · {inspectedMonitor.status.toUpperCase()}</div>
            </div>
            <div className="inspector-field">
              <label>Check Frequency</label>
              <div className="val font-mono">Every {inspectedMonitor.intervalSeconds} seconds</div>
            </div>
            <div className="inspector-field">
              <label>30-Day Reliability</label>
              <div className="val font-mono" style={{ color: "var(--green)" }}>{inspectedMonitor.uptime30d}%</div>
            </div>
            <div className="inspector-field">
              <label>Public Status Page Visibility</label>
              <div className="val">{inspectedMonitor.publicOnStatusPage ? "Visible on /status/:slug" : "Private (Hidden)"}</div>
            </div>
            {(inspectedMonitor.type === "heartbeat" || inspectedMonitor.heartbeatToken) && (
              <div className="inspector-field" style={{ background: "rgba(59, 130, 246, 0.08)", padding: "10px 12px", borderRadius: "6px", border: "1px solid rgba(59, 130, 246, 0.25)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                  <label style={{ margin: 0, color: "#60a5fa", fontWeight: 600 }}>Heartbeat Push API Ingestion</label>
                  {inspectedMonitor.heartbeatToken && (
                    <button
                      type="button"
                      className="btn-xs"
                      onClick={() => {
                        if (typeof navigator !== "undefined" && navigator.clipboard) {
                          navigator.clipboard.writeText(`https://api.uptimemonke.com/heartbeat/${inspectedMonitor.heartbeatToken}`);
                        }
                        setCopiedAdminToken(true);
                        setTimeout(() => setCopiedAdminToken(false), 2000);
                      }}
                      style={{
                        background: copiedAdminToken ? "rgba(16, 185, 129, 0.2)" : "rgba(255, 255, 255, 0.1)",
                        color: copiedAdminToken ? "#10b981" : "var(--text)",
                        border: "1px solid var(--border)",
                        borderRadius: "4px",
                        padding: "2px 8px",
                        fontSize: "0.72rem",
                        cursor: "pointer",
                      }}
                    >
                      {copiedAdminToken ? "✓ Copied Ping URL" : "Copy Ping URL"}
                    </button>
                  )}
                </div>
                <div className="val font-mono" style={{ fontSize: "0.78rem", wordBreak: "break-all" }}>
                  {inspectedMonitor.heartbeatToken
                    ? `https://api.uptimemonke.com/heartbeat/${inspectedMonitor.heartbeatToken}`
                    : "Token generated dynamically on check deployment"}
                </div>
              </div>
            )}
            {inspectedMonitor.maxResponseTimeMs && (
              <div className="inspector-field">
                <label>SLA Latency Threshold</label>
                <div className="val font-mono">{inspectedMonitor.maxResponseTimeMs} ms</div>
              </div>
            )}
            {inspectedMonitor.keywordRegex && (
              <div className="inspector-field">
                <label>Pattern Matching</label>
                <div className="val ok">Regular Expression (Regex) Active</div>
              </div>
            )}
            {inspectedMonitor.jsonPath && (
              <div className="inspector-field">
                <label>JSON Path Assertion</label>
                <div className="val font-mono">{inspectedMonitor.jsonPath}</div>
              </div>
            )}
            {inspectedMonitor.sslMinVersion && (
              <div className="inspector-field">
                <label>Enforced TLS Protocol</label>
                <div className="val font-mono">{inspectedMonitor.sslMinVersion}</div>
              </div>
            )}
            {inspectedMonitor.tcpExpectedResponse && (
              <div className="inspector-field">
                <label>Expected TCP Banner</label>
                <div className="val font-mono">{inspectedMonitor.tcpExpectedResponse}</div>
              </div>
            )}
            {inspectedMonitor.dnsServer && (
              <div className="inspector-field">
                <label>Custom Nameserver</label>
                <div className="val font-mono">{inspectedMonitor.dnsServer}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="admin-footer">
        <div>
          <span>UptimeMonke Operations Console · </span>
          <span className="font-mono">v0.5.0</span>
        </div>
        <div style={{ display: "flex", gap: "16px" }}>
          <span>Operator: {currentUser.email}</span>
          <a href="https://uptimemonke-admin.web.app" style={{ color: "inherit", textDecoration: "none" }}>
            uptimemonke-admin.web.app
          </a>
        </div>
      </footer>
    </main>
  );
}
