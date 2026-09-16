import { onCall, HttpsError } from "firebase-functions/v2/https";
import { randomBytes } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import { col } from "../lib/firestore";
import { limitsFor, type PlanLimits } from "../lib/plans";
import {
  BlockedTargetError,
  assertPublicHost,
  assertSafeUrl,
  hostFromTarget,
  sanitizeHeaders,
} from "../lib/targetGuard";
import { PRIMARY_REGION, PROBE_REGIONS } from "../config";
import type { Monitor, MonitorType, Org, ProbeRegion } from "../types";

/**
 * One validator, two callers.
 *
 * Monitor writes used to happen on two paths with different rules: the REST API
 * checked plan limits, while the dashboard wrote to Firestore directly and
 * checked nothing — so a free account could create unlimited monitors at any
 * interval just by using the UI. Firestore rules cannot do the counting or the
 * DNS resolution this needs, so creation and config edits are backend-only now
 * and both entry points land here.
 */

const MONITOR_TYPES: MonitorType[] = [
  "http",
  "keyword",
  "tcp",
  "dns",
  "ssl",
  "heartbeat",
];

export interface MonitorInput {
  name?: string;
  type?: string;
  target?: string;
  port?: number;
  method?: string;
  requestHeaders?: Record<string, string>;
  requestBody?: string;
  acceptedStatusCodes?: string[];
  followRedirects?: boolean;
  keyword?: string;
  keywordInverted?: boolean;
  dnsRecordType?: string;
  dnsExpectedValue?: string;
  sslExpiryWarningDays?: number;
  heartbeatGraceSeconds?: number;
  intervalSeconds?: number;
  timeoutSeconds?: number;
  confirmationThreshold?: number;
  regions?: string[];
  alertContactIds?: string[];
  maintenanceWindows?: Monitor["maintenanceWindows"];
}

const clamp = (n: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, n));

/** Rejects a target a probe must not be pointed at. Throws HttpsError. */
async function validateTarget(type: MonitorType, target: string): Promise<void> {
  try {
    if (type === "http" || type === "keyword") {
      await assertSafeUrl(target);
    } else {
      await assertPublicHost(hostFromTarget(target));
    }
  } catch (err) {
    if (err instanceof BlockedTargetError) {
      throw new HttpsError("invalid-argument", err.message);
    }
    throw err;
  }
}

/**
 * Turn untrusted input into a Monitor, or throw. `existing` is passed on edit
 * so unspecified fields keep their current value.
 */
export async function buildMonitor(
  input: MonitorInput,
  orgId: string,
  limits: PlanLimits,
  existing?: Monitor
): Promise<Partial<Monitor>> {
  const type = (input.type ?? existing?.type ?? "http") as MonitorType;
  if (!MONITOR_TYPES.includes(type)) {
    throw new HttpsError("invalid-argument", `Unknown monitor type "${type}"`);
  }

  const target = String(input.target ?? existing?.target ?? "").trim();
  if (type !== "heartbeat") {
    if (!target) {
      throw new HttpsError("invalid-argument", "A target is required");
    }
    await validateTarget(type, target);
  }

  const interval = Math.max(
    limits.minIntervalSeconds,
    Number(input.intervalSeconds ?? existing?.intervalSeconds) ||
      limits.minIntervalSeconds
  );

  // Silently downgrading to one region would hide a plan limit from the user,
  // so say so instead.
  let regions: ProbeRegion[] = (input.regions as ProbeRegion[]) ??
    existing?.regions ?? [PRIMARY_REGION];
  regions = regions.filter((r) => PROBE_REGIONS.includes(r));
  if (!regions.length) regions = [PRIMARY_REGION];
  if (!limits.multiRegion && regions.length > 1) {
    throw new HttpsError(
      "permission-denied",
      `Multi-region checks are not available on the ${limits.label} plan`
    );
  }

  const now = Timestamp.now();
  const monitor: Partial<Monitor> = {
    orgId,
    name: String(input.name ?? existing?.name ?? target ?? "Untitled").slice(0, 120),
    type,
    target,
    intervalSeconds: interval,
    timeoutSeconds: clamp(
      Number(input.timeoutSeconds ?? existing?.timeoutSeconds) || 10,
      1,
      30
    ),
    confirmationThreshold: clamp(
      Number(input.confirmationThreshold ?? existing?.confirmationThreshold) || 2,
      1,
      10
    ),
    regions,
    alertContactIds: input.alertContactIds ?? existing?.alertContactIds ?? [],
    maintenanceWindows:
      input.maintenanceWindows ?? existing?.maintenanceWindows ?? [],
    updatedAt: now,
  };

  if (input.port !== undefined || existing?.port !== undefined) {
    monitor.port = clamp(Number(input.port ?? existing?.port) || 443, 1, 65535);
  }
  if (type === "http" || type === "keyword") {
    monitor.method = (input.method ?? existing?.method ?? "HEAD") as Monitor["method"];
    monitor.requestHeaders = sanitizeHeaders(
      input.requestHeaders ?? existing?.requestHeaders
    );
    monitor.requestBody = input.requestBody ?? existing?.requestBody;
    monitor.acceptedStatusCodes =
      input.acceptedStatusCodes ?? existing?.acceptedStatusCodes ?? ["2xx", "3xx"];
    monitor.followRedirects = input.followRedirects ?? existing?.followRedirects ?? true;
  }
  if (type === "keyword") {
    const keyword = input.keyword ?? existing?.keyword;
    if (!keyword) {
      throw new HttpsError("invalid-argument", "Keyword monitors need a keyword");
    }
    monitor.keyword = keyword;
    monitor.keywordInverted = input.keywordInverted ?? existing?.keywordInverted ?? false;
  }
  if (type === "dns") {
    monitor.dnsRecordType = (input.dnsRecordType ??
      existing?.dnsRecordType ??
      "A") as Monitor["dnsRecordType"];
    monitor.dnsExpectedValue = input.dnsExpectedValue ?? existing?.dnsExpectedValue;
  }
  if (type === "ssl") {
    monitor.sslExpiryWarningDays = clamp(
      Number(input.sslExpiryWarningDays ?? existing?.sslExpiryWarningDays) || 14,
      1,
      365
    );
  }
  if (type === "heartbeat") {
    monitor.heartbeatToken =
      existing?.heartbeatToken ?? randomBytes(24).toString("base64url");
    monitor.heartbeatGraceSeconds = Math.max(
      60,
      Number(input.heartbeatGraceSeconds ?? existing?.heartbeatGraceSeconds) || interval
    );
  }

  return monitor;
}

/** Shared by the callable and the REST API. Enforces the per-plan cap. */
export async function assertCanAddMonitor(
  orgId: string,
  limits: PlanLimits
): Promise<void> {
  const count = await col.monitors().where("orgId", "==", orgId).count().get();
  if (count.data().count >= limits.maxMonitors) {
    throw new HttpsError(
      "resource-exhausted",
      `Plan limit reached (${limits.maxMonitors} monitors on ${limits.label})`
    );
  }
}

export async function limitsForOrg(orgId: string): Promise<PlanLimits> {
  const org = (await col.orgs().doc(orgId).get()).data() as Org | undefined;
  return limitsFor(org?.plan);
}

function orgOf(req: { auth?: { token: Record<string, unknown> } }): string {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in first");
  const orgId = req.auth.token.orgId as string | undefined;
  if (!orgId) throw new HttpsError("failed-precondition", "No organisation on token");
  return orgId;
}

export const createMonitor = onCall({ region: PRIMARY_REGION }, async (req) => {
  const orgId = orgOf(req);
  const limits = await limitsForOrg(orgId);
  await assertCanAddMonitor(orgId, limits);

  const monitor = await buildMonitor(req.data as MonitorInput, orgId, limits);
  const now = Timestamp.now();
  const ref = await col.monitors().add({
    ...monitor,
    enabled: true,
    status: "pending",
    inMaintenance: false,
    consecutiveFailures: 0,
    nextCheckAt: now, // check it immediately so the user sees a result
    createdAt: now,
  } as Monitor);

  return { id: ref.id, ...monitor };
});

export const updateMonitor = onCall({ region: PRIMARY_REGION }, async (req) => {
  const orgId = orgOf(req);
  const { id, ...input } = (req.data ?? {}) as MonitorInput & { id?: string };
  if (!id) throw new HttpsError("invalid-argument", "id is required");

  const snap = await col.monitor(id).get();
  const existing = snap.data() as Monitor | undefined;
  if (!snap.exists || existing?.orgId !== orgId) {
    throw new HttpsError("not-found", "No such monitor");
  }

  const limits = await limitsForOrg(orgId);
  const monitor = await buildMonitor(input, orgId, limits, existing);
  await col.monitor(id).update(monitor);

  return { id, ...monitor };
});
