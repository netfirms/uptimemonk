import { randomBytes } from "node:crypto";
import {
  BlockedTargetError,
  assertPublicHost,
  assertSafeUrl,
  hostFromTarget,
  sanitizeHeaders,
} from "../lib/targetGuard.js";
import { limitsFor, type PlanLimits } from "../lib/plans.js";
import { REGION } from "../config.js";
import type { Monitor, MonitorType, Plan, ProbeRegion } from "../types.js";

/**
 * The single validator every monitor write passes through — the dashboard's
 * API calls and the public REST API both land here.
 *
 * Two jobs that cannot be done anywhere else: enforcing plan limits (needs a
 * count) and refusing an unsafe target (needs a DNS resolution). Neither is
 * expressible in Firestore security rules, which is exactly why monitor
 * creation is backend-only.
 */

export class ValidationError extends Error {
  constructor(
    message: string,
    readonly status = 400
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

const MONITOR_TYPES: MonitorType[] = [
  "http",
  "keyword",
  "tcp",
  "dns",
  "ssl",
  "icmp",
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
  keywordCaseSensitive?: boolean;
  dnsRecordType?: string;
  dnsExpectedValue?: string;
  sslExpiryWarningDays?: number;
  heartbeatGraceSeconds?: number;
  intervalSeconds?: number;
  timeoutSeconds?: number;
  confirmationThreshold?: number;
  regions?: string[];
  publicOnStatusPage?: boolean;
  muteAlerts?: boolean;
  alertContactIds?: string[];
  maintenanceWindows?: Monitor["maintenanceWindows"];
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

const KNOWN_REGIONS: ProbeRegion[] = ["ap-southeast-1", "us-east-1", "eu-west-1"];

async function validateTarget(type: MonitorType, target: string): Promise<void> {
  try {
    if (type === "http" || type === "keyword") await assertSafeUrl(target);
    else await assertPublicHost(hostFromTarget(target));
  } catch (err) {
    if (err instanceof BlockedTargetError) throw new ValidationError(err.message);
    throw err;
  }
}

/** Build a validated monitor, or throw. `existing` is passed on edit. */
export async function buildMonitor(
  input: MonitorInput,
  orgId: string,
  plan: Plan,
  existing?: Monitor
): Promise<Partial<Monitor>> {
  const limits: PlanLimits = limitsFor(plan);
  const type = (input.type ?? existing?.type ?? "http") as MonitorType;
  if (!MONITOR_TYPES.includes(type)) {
    throw new ValidationError(`Unknown monitor type "${type}"`);
  }

  const target = String(input.target ?? existing?.target ?? "").trim();
  if (type !== "heartbeat") {
    if (!target) throw new ValidationError("A target is required");
    await validateTarget(type, target);
  }

  const interval = Math.max(
    limits.minIntervalSeconds,
    Number(input.intervalSeconds ?? existing?.intervalSeconds) || limits.minIntervalSeconds
  );

  let regions = ((input.regions as ProbeRegion[]) ??
    existing?.regions ?? [REGION]) as ProbeRegion[];
  regions = regions.filter((r) => KNOWN_REGIONS.includes(r));
  if (!regions.length) regions = [REGION];
  // Say so rather than silently downgrading — a hidden plan limit reads as a
  // broken feature.
  if (!limits.multiRegion && regions.length > 1) {
    throw new ValidationError(
      `Multi-region checks are not available on the ${limits.label} plan`,
      403
    );
  }

  const now = Date.now();
  const monitor: Partial<Monitor> = {
    orgId,
    name: String(input.name ?? existing?.name ?? target ?? "Untitled").slice(0, 120),
    type,
    target,
    intervalSeconds: interval,
    timeoutSeconds: clamp(Number(input.timeoutSeconds ?? existing?.timeoutSeconds) || 10, 1, 30),
    confirmationThreshold: clamp(
      Number(input.confirmationThreshold ?? existing?.confirmationThreshold) || 2,
      1,
      10
    ),
    regions,
    alertContactIds: input.alertContactIds ?? existing?.alertContactIds ?? [],
    publicOnStatusPage:
      input.publicOnStatusPage ?? existing?.publicOnStatusPage ?? false,
    muteAlerts: input.muteAlerts ?? existing?.muteAlerts ?? false,
    maintenanceWindows: input.maintenanceWindows ?? existing?.maintenanceWindows ?? [],
    updatedAt: now,
  };

  if (input.port !== undefined || existing?.port !== undefined) {
    monitor.port = clamp(Number(input.port ?? existing?.port) || 443, 1, 65535);
  }
  if (type === "http" || type === "keyword") {
    // A keyword check needs a body, and HEAD responses have none — so HEAD
    // plus a keyword is not a preference, it is a contradiction that reports a
    // permanent false outage. The default used to be HEAD for both types,
    // which made every keyword monitor fail from the moment it was created.
    const requested = input.method ?? existing?.method;
    if (type === "keyword") {
      if (input.method && input.method !== "GET" && input.method !== "POST") {
        throw new ValidationError(
          `A keyword monitor must use GET or POST — ${input.method} returns no body to search`
        );
      }
      // Treat a stored HEAD as legacy data rather than intent: the form never
      // offered the choice, so the value came from the old default.
      monitor.method = (requested === "POST" ? "POST" : "GET") as Monitor["method"];
    } else {
      monitor.method = (requested ?? "HEAD") as Monitor["method"];
    }
    // Strips Metadata-Flavor and friends: a customer must not be able to make
    // our probe look like an internal client.
    monitor.requestHeaders = sanitizeHeaders(input.requestHeaders ?? existing?.requestHeaders);
    monitor.requestBody = input.requestBody ?? existing?.requestBody;
    monitor.acceptedStatusCodes =
      input.acceptedStatusCodes ?? existing?.acceptedStatusCodes ?? ["2xx", "3xx"];
    monitor.followRedirects = input.followRedirects ?? existing?.followRedirects ?? true;
  }
  if (type === "keyword") {
    const keyword = input.keyword ?? existing?.keyword;
    if (!keyword) throw new ValidationError("Keyword monitors need a keyword");
    monitor.keyword = keyword;
    monitor.keywordInverted = input.keywordInverted ?? existing?.keywordInverted ?? false;
    monitor.keywordCaseSensitive =
      input.keywordCaseSensitive ?? existing?.keywordCaseSensitive ?? false;
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
    monitor.heartbeatToken = existing?.heartbeatToken ?? randomBytes(24).toString("base64url");
    monitor.heartbeatGraceSeconds = Math.max(
      60,
      Number(input.heartbeatGraceSeconds ?? existing?.heartbeatGraceSeconds) || interval
    );
  }

  // Firestore rejects an explicit `undefined` outright, and several fields
  // above are built with `input.x ?? existing?.x` — which yields undefined
  // whenever neither side set them. That threw on every create and edit:
  //   Cannot use "undefined" as a Firestore value (found in field "requestBody")
  //
  // Dropping the keys is deliberate over enabling `ignoreUndefinedProperties`
  // on the client: a field that was never set should be absent, and a genuine
  // mistake elsewhere should still fail loudly rather than be swallowed.
  return stripUndefined(monitor);
}

/** Remove keys whose value is undefined. Shallow by design — no nested field
 *  in a monitor is built with the `??` pattern that produces them. */
export function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) out[key] = value;
  }
  return out as Partial<T>;
}
