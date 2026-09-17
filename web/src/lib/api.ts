"use client";

import { collection, doc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import type { RangeKey } from "@/components/RangeTabs";

/**
 * Client for the UptimeMonke worker API.
 *
 * Every mutation goes through the API and there is deliberately no direct
 * Firestore fallback. `target` becomes an outbound request from inside our
 * network, so it must pass the server's target guard — which resolves the
 * hostname and rejects the link-local range where the cloud metadata services
 * live. Plan limits need a count. Security rules can do neither, and they deny
 * client writes to `monitors` outright, so a fallback could only ever turn one
 * clear error into a confusing second one.
 *
 * Reads stay on Firestore, where the realtime listener is free.
 */

export const BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL ??
  (typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:3000"
    : "https://uptimemonke.com");

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  (typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:8080"
    : "https://api.uptimemonke.com");

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new ApiError("Sign in to continue", 401);

  // Only claim a JSON body when one is actually being sent. DELETE and the
  // pause POST carry none, and Fastify rejects an empty body declared as
  // application/json (FST_ERR_CTP_EMPTY_JSON_BODY) — which is why deleting a
  // monitor failed with a generic server error.
  const headers: Record<string, string> = {
    authorization: `Bearer ${await user.getIdToken()}`,
    ...(init.headers as Record<string, string> | undefined),
  };
  if (init.body != null) headers["content-type"] = "application/json";

  const res = await fetch(`${API_URL}${path}`, { ...init, headers });

  if (res.status === 204) return undefined as T;

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(
      body.error ?? "Something went wrong. Please try again.",
      res.status,
      body.code
    );
  }
  return body as T;
}

export interface MonitorInput {
  alertContactIds?: string[];
  muteAlerts?: boolean;
  name?: string;
  type: string;
  target?: string;
  port?: number;
  keyword?: string;
  intervalSeconds?: number;
}

/**
 * Mutations resolve a DNS lookup inside the server's target guard, so they are
 * legitimately slower than a plain write. The previous 2.5 s budget expired on
 * ordinary requests and silently diverted them to a fallback path.
 */
const MUTATION_TIMEOUT_MS = 15_000;

export interface HistorySample {
  t: number;
  ms: number;
  ok: boolean;
  code?: number;
}

/** One bar: an hour or a day, depending on the range. */
export interface Bucket {
  /** Start of the bucket, epoch ms. */
  t: number;
  up: number;
  down: number;
  avgMs: number;
  uptimeRatio: number;
}

/** One point on the response-time line. */
export interface Point {
  t: number;
  ms: number;
  ok: boolean;
  /** Only on hourly ranges — a daily average has no single status code. */
  code?: number;
}

export interface DayRollup {
  day: string;
  up: number;
  down: number;
  avgMs: number;
  uptimeRatio: number;
  downtimeSeconds: number;
}

export interface HistoryIncident {
  id: string;
  startedAt: number;
  resolvedAt?: number | null;
  durationSeconds?: number;
  cause: string;
  status: "open" | "resolved";
}

export interface MonitorHistory {
  monitor: {
    id: string;
    name: string;
    type: string;
    target: string;
    status: string;
    enabled: boolean;
    intervalSeconds: number;
    lastCheckedAt: number | null;
    lastResponseTimeMs: number | null;
    lastError: string | null;
    uptime24h: number | null;
    uptime7d: number | null;
    uptime30d: number | null;
    certExpiresAt: number | null;
    certIssuedAt: number | null;
    certIssuer: string | null;
    sslExpiryAlertDays: number[] | null;
    heartbeatToken?: string | null;
    heartbeatGraceSeconds?: number | null;
  };
  range: RangeKey;
  granularity: "hour" | "day";
  buckets: Bucket[];
  points: Point[];
  incidents: HistoryIncident[];
  /** Scoped to `range`, not all-time. */
  summary: { checks: number; up: number; down: number; avgMs: number };

  /** @deprecated Superseded by `buckets` / `points`; kept so a tab holding an
   *  older bundle keeps rendering until it reloads. */
  days: DayRollup[];
  /** @deprecated See `days`. */
  samples: HistorySample[];
  /** @deprecated See `days`. */
  window: { hours: number; days: number };
}

export type AlertChannel = "email" | "slack" | "discord" | "telegram" | "webhook";

export interface AlertContact {
  id: string;
  channel: AlertChannel;
  name: string;
  destination: string;
  telegramChatId?: string | null;
  enabled: boolean;
  /** Nothing is delivered to a contact that has not confirmed. */
  verified: boolean;
  verificationSentAt?: number | null;
}

export type Standing = "free" | "donor" | "grace" | "lapsed";

export interface Billing {
  standing: Standing;
  credits: number;
  donationUsdMonthly: number;
  graceUntil: number | null;
  checksPerDayBudget: number;
  /** Monitor-count cap, which the budget does not express. */
  maxMonitors: number;
  suggestedUsd: number[];
  /** The one-click Payment Link, already tagged with this workspace. */
  link?: {
    url: string;
    cents: number;
    checks: number;
    /** A monthly subscription rather than a one-off. */
    recurring?: boolean;
    /** False means a donation would be taken but never credited — the
     *  webhook secret is missing. */
    credited: boolean;
  };
  /** False when the server has no Stripe secret key. Only custom amounts
   *  need it; the Payment Link works without one. */
  enabled: boolean;
  preview: { usd: number; checks: number }[];
}

/** Checks per day a monitor at this interval performs — the price of a
 *  monitor, mirroring `checksPerDay` on the server. */
export const checksPerDay = (intervalSeconds: number) =>
  Math.ceil(86_400 / Math.max(5, intervalSeconds));

export interface OrgSettings {
  orgId: string;
  name: string;
  statusPage: {
    slug: string | null;
    title: string | null;
    description: string | null;
    published: boolean;
    url: string;
    /** A starting point derived from the workspace name, never auto-claimed. */
    suggestion: string;
  };
}

export const api = {
  org: () => request<OrgSettings>("/v1/org"),

  renameOrg: (name: string) =>
    request<{ name: string }>("/v1/org", {
      method: "PATCH",
      body: JSON.stringify({ name }),
      signal: AbortSignal.timeout(MUTATION_TIMEOUT_MS),
    }),

  setStatusPage: (input: {
    slug: string;
    title?: string;
    description?: string;
    published?: boolean;
  }) =>
    request<{ slug: string; url: string; replaced: string | null }>("/v1/org/status-page", {
      method: "PUT",
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(MUTATION_TIMEOUT_MS),
    }),

  billing: () => request<Billing>("/v1/billing"),

  donate: (usd: number) =>
    request<{ url: string }>("/v1/billing/checkout", {
      method: "POST",
      body: JSON.stringify({ usd }),
      signal: AbortSignal.timeout(MUTATION_TIMEOUT_MS),
    }),

  contacts: () =>
    request<{
      contacts: AlertContact[];
      /** Channels needing a server credential report "unconfigured". */
      channels: Record<AlertChannel, "ready" | "unconfigured">;
    }>("/v1/contacts"),

  createContact: (input: {
    channel: AlertChannel;
    name?: string;
    destination: string;
    telegramChatId?: string;
  }) =>
    request<AlertContact>("/v1/contacts", {
      method: "POST",
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(MUTATION_TIMEOUT_MS),
    }),

  updateContact: (id: string, input: { name?: string; enabled?: boolean }) =>
    request<{ id: string }>(`/v1/contacts/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(MUTATION_TIMEOUT_MS),
    }),

  deleteContact: (id: string) =>
    request<{ deleted: boolean; detachedFrom: number }>(`/v1/contacts/${id}`, {
      method: "DELETE",
      signal: AbortSignal.timeout(MUTATION_TIMEOUT_MS),
    }),

  /** Sends a real alert now, through the same path the drainer uses, and
   *  waits for the provider so a failure comes back with its reason. */
  testContact: (id: string) =>
    request<{ delivered: boolean; channel: string; destination: string }>(
      `/v1/contacts/${id}/test`,
      { method: "POST", signal: AbortSignal.timeout(MUTATION_TIMEOUT_MS) }
    ),

  /** Sends the confirmation over the contact's own channel — the only proof
   *  the destination is reachable and wanted. */
  verifyContact: (id: string) =>
    request<{ sent?: boolean; alreadyVerified?: boolean; channel?: string }>(
      `/v1/contacts/${id}/verify`,
      { method: "POST", signal: AbortSignal.timeout(MUTATION_TIMEOUT_MS) }
    ),

  createMonitor: (input: MonitorInput) =>
    request<{ id: string; heartbeatToken?: string }>("/v1/monitors", {
      method: "POST",
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(MUTATION_TIMEOUT_MS),
    }),

  updateMonitor: (id: string, input: Partial<MonitorInput>) =>
    request<{ id: string }>(`/v1/monitors/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(MUTATION_TIMEOUT_MS),
    }),

  togglePause: (id: string) =>
    request<{ id: string; enabled: boolean }>(`/v1/monitors/${id}/pause`, {
      method: "POST",
      signal: AbortSignal.timeout(MUTATION_TIMEOUT_MS),
    }),

  deleteMonitor: (id: string) =>
    request<void>(`/v1/monitors/${id}`, {
      method: "DELETE",
      signal: AbortSignal.timeout(MUTATION_TIMEOUT_MS),
    }),

  /**
   * Creates the workspace for a new account. Backend-only by necessity: it
   * sets the custom claim that every security rule reads for tenancy, which a
   * client cannot do. Idempotent — a retry after a dropped response is normal.
   */
  /** The token is only spent on workspace creation — see lib/recaptcha.ts for
   *  why that is the one place it can be enforced. */
  bootstrap: (recaptchaToken?: string) =>
    request<{ orgId: string; created: boolean }>("/v1/bootstrap", {
      body: JSON.stringify({ recaptchaToken }),
      method: "POST",
      signal: AbortSignal.timeout(MUTATION_TIMEOUT_MS),
    }),

  /** Everything the detail view needs, served from the worker's SQLite. */
  history: (id: string, opts: { hours?: number; days?: number; range?: RangeKey } = {}) => {
    const q = new URLSearchParams();
    if (opts.range) q.set("range", opts.range);
    if (opts.hours) q.set("hours", String(opts.hours));
    if (opts.days) q.set("days", String(opts.days));
    const qs = q.toString();
    return request<MonitorHistory>(`/v1/monitors/${id}/history${qs ? `?${qs}` : ""}`);
  },

  me: async () => {
    const user = auth.currentUser;
    if (!user) throw new ApiError("Sign in to continue", 401);
    return request<{
      uid: string;
      orgId: string;
      role: string;
      plan: string;
      limits: { label: string; minIntervalSeconds: number; maxMonitors: number };
    }>("/v1/me");
  },

  version: async () => {
    try {
      const res = await fetch(`${API_URL}/version`, { signal: AbortSignal.timeout(2000) });
      if (!res.ok) throw new Error("Could not fetch API version");
      return (await res.json()) as { api: string; worker: string; region: string };
    } catch {
      return { api: "0.1.0", worker: "0.1.0", region: "ap-southeast-1" };
    }
  },
};
