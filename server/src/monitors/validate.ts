import { randomBytes } from "node:crypto";
import {
  BlockedTargetError,
  assertPublicHost,
  assertSafeUrl,
  hostFromTarget,
  sanitizeHeaders,
} from "../lib/targetGuard.js";
import { limitsFor, type PlanLimits } from "../lib/plans.js";
import { normaliseAlertDays } from "./certWatch.js";
import {
  MAX_MONITORS_DONOR,
  MAX_MONITORS_FREE,
  minIntervalFor,
  SCHEDULER_MIN_INTERVAL_SECONDS,
  MIN_INTERVAL_SECONDS_FREE,
  MIN_INTERVAL_SECONDS_DONOR,
  maxMonitorsFor,
  checksPerDay,
  fitsBudget,
  type OrgCredit,
} from "../lib/credits.js";
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
  keywordRegex?: boolean;
  jsonPath?: string;
  jsonPathExpected?: string;
  maxResponseTimeMs?: number;
  httpAuthType?: string;
  dnsRecordType?: string;
  dnsExpectedValue?: string;
  dnsServer?: string;
  sslExpiryAlertDays?: number[];
  sslExpiryWarningDays?: number;
  sslExpectedFingerprint?: string;
  sslMinVersion?: string;
  tcpPayload?: string;
  tcpExpectedResponse?: string;
  icmpPacketCount?: number;
  icmpMaxLossPercent?: number;
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
  existing?: Monitor,
  /**
   * The workspace's credit, for the per-standing interval floor.
   *
   * Passed in rather than read here so this stays a pure function — its
   * tests call it without a database, the way they call it without Firestore.
   * Omitted means the free floor, which is the conservative default: the API
   * always has the credit and always passes it.
   */
  credit?: OrgCredit
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

  /**
   * Two floors apply, and they answer different questions.
   *
   * `SCHEDULER_MIN_INTERVAL_SECONDS` is what the scheduler can physically
   * honour — nothing goes below it on any standing. On top of that sits a
   * per-standing floor an operator sets: free workspaces are held to a slower
   * interval than donors.
   *
   * The budget still applies on top of both. A donor may ask for 5s and
   * `assertFitsBudget` may still refuse it, because the floor says what you
   * may request and the budget says what you can afford.
   *
   * Asking below your floor is refused rather than quietly rounded up. A
   * silently changed interval reads as a broken feature — the monitor would
   * simply run at a rate nobody chose.
   */
  const requested = Number(input.intervalSeconds ?? existing?.intervalSeconds) || 60;
  const standingFloor = credit ? minIntervalFor(credit) : MIN_INTERVAL_SECONDS_FREE;
  const floor = Math.max(SCHEDULER_MIN_INTERVAL_SECONDS, standingFloor);

  if (requested < floor) {
    throw new ValidationError(
      standingFloor > SCHEDULER_MIN_INTERVAL_SECONDS
        ? `The fastest interval on a free workspace is ${floor} seconds. ` +
          `Supporting the project lowers it to ${MIN_INTERVAL_SECONDS_DONOR} seconds.`
        : `The fastest interval this fleet supports is ${floor} seconds.`
    );
  }
  const interval = requested;

  let regions = ((input.regions as ProbeRegion[]) ??
    existing?.regions ?? [REGION]) as ProbeRegion[];
  regions = regions.filter((r) => KNOWN_REGIONS.includes(r));
  if (!regions.length) regions = [REGION];
  // Say so rather than silently downgrading — a hidden plan limit reads as a
  // broken feature.
  // Multi-region doubles the checks, so the budget already prices it. Only the
  // fleet size limits it now.
  if (regions.length > KNOWN_REGIONS.length) {
    throw new ValidationError("More regions were requested than the fleet has", 400);
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
    const VALID_METHODS = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"];
    if (input.method && !VALID_METHODS.includes(input.method.toUpperCase())) {
      throw new ValidationError(`Unsupported HTTP method: ${input.method}`);
    }
    const requested = (input.method ?? existing?.method)?.toUpperCase();
    if (type === "keyword") {
      if (input.method && input.method.toUpperCase() === "HEAD") {
        throw new ValidationError(
          `A keyword monitor cannot use HEAD — HEAD returns no body to search`
        );
      }
      // Treat a stored HEAD as legacy data rather than intent: the form never
      // offered the choice, so the value came from the old default.
      monitor.method = (requested && ["POST", "PUT", "PATCH", "DELETE"].includes(requested)
        ? requested
        : "GET") as Monitor["method"];
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

    const maxRt = input.maxResponseTimeMs ?? existing?.maxResponseTimeMs;
    if (maxRt !== undefined && maxRt !== null && maxRt !== 0) {
      monitor.maxResponseTimeMs = clamp(Number(maxRt), 50, 60000);
    }
    if (input.httpAuthType ?? existing?.httpAuthType) {
      const authType = input.httpAuthType ?? existing?.httpAuthType;
      if (["none", "basic", "bearer"].includes(authType!)) {
        monitor.httpAuthType = authType as Monitor["httpAuthType"];
      }
    }
  }
  if (type === "keyword") {
    const keyword = input.keyword ?? existing?.keyword;
    if (!keyword) throw new ValidationError("Keyword monitors need a keyword");
    monitor.keyword = keyword;
    monitor.keywordInverted = input.keywordInverted ?? existing?.keywordInverted ?? false;
    monitor.keywordCaseSensitive =
      input.keywordCaseSensitive ?? existing?.keywordCaseSensitive ?? false;
    monitor.keywordRegex = input.keywordRegex ?? existing?.keywordRegex ?? false;
    if (monitor.keywordRegex) {
      try {
        new RegExp(keyword);
      } catch (err) {
        throw new ValidationError(`Invalid regular expression in keyword: ${(err as Error).message}`);
      }
    }
    if (input.jsonPath !== undefined || existing?.jsonPath !== undefined) {
      monitor.jsonPath = (input.jsonPath ?? existing?.jsonPath)?.trim();
      monitor.jsonPathExpected = input.jsonPathExpected ?? existing?.jsonPathExpected;
    }
  }
  if (type === "dns") {
    const VALID_DNS = ["A", "AAAA", "CNAME", "MX", "TXT", "NS", "CAA", "SOA", "PTR", "SRV"];
    const recType = (input.dnsRecordType ?? existing?.dnsRecordType ?? "A").toUpperCase();
    if (!VALID_DNS.includes(recType)) {
      throw new ValidationError(`Unsupported DNS record type: ${recType}`);
    }
    monitor.dnsRecordType = recType as Monitor["dnsRecordType"];
    monitor.dnsExpectedValue = input.dnsExpectedValue ?? existing?.dnsExpectedValue;

    const dnsServer = input.dnsServer ?? existing?.dnsServer;
    if (dnsServer) {
      const serverHost = hostFromTarget(dnsServer);
      try {
        await assertPublicHost(serverHost);
      } catch (err) {
        if (err instanceof BlockedTargetError) {
          throw new ValidationError(`Custom DNS server "${dnsServer}" is invalid: ${err.message}`);
        }
        throw err;
      }
      monitor.dnsServer = serverHost;
    }
  }
  if (type === "ssl") {
    // Several thresholds now. The old single field is still read so a monitor
    // created before this keeps exactly the one warning it was configured with,
    // rather than silently gaining three more pages.
    monitor.sslExpiryAlertDays = normaliseAlertDays(
      input.sslExpiryAlertDays ?? existing?.sslExpiryAlertDays,
      input.sslExpiryWarningDays ?? existing?.sslExpiryWarningDays
    );
    monitor.sslExpiryWarningDays = clamp(
      Number(input.sslExpiryWarningDays ?? existing?.sslExpiryWarningDays) || 14,
      1,
      365
    );
    const fp = input.sslExpectedFingerprint ?? existing?.sslExpectedFingerprint;
    if (fp) monitor.sslExpectedFingerprint = fp.trim().toUpperCase();

    const minVer = input.sslMinVersion ?? existing?.sslMinVersion;
    if (minVer === "TLSv1.2" || minVer === "TLSv1.3") {
      monitor.sslMinVersion = minVer;
    }
  }
  if (type === "tcp") {
    if (input.tcpPayload !== undefined || existing?.tcpPayload !== undefined) {
      monitor.tcpPayload = String(input.tcpPayload ?? existing?.tcpPayload ?? "").slice(0, 1024);
    }
    if (input.tcpExpectedResponse !== undefined || existing?.tcpExpectedResponse !== undefined) {
      monitor.tcpExpectedResponse = String(
        input.tcpExpectedResponse ?? existing?.tcpExpectedResponse ?? ""
      ).slice(0, 1024);
    }
  }
  if (type === "icmp") {
    const pktCount = input.icmpPacketCount ?? existing?.icmpPacketCount;
    if (pktCount !== undefined) {
      const parsed = Number(pktCount);
      monitor.icmpPacketCount = clamp(Number.isFinite(parsed) ? parsed : 3, 1, 5);
    }
    const maxLoss = input.icmpMaxLossPercent ?? existing?.icmpMaxLossPercent;
    if (maxLoss !== undefined) {
      const parsed = Number(maxLoss);
      monitor.icmpMaxLossPercent = clamp(Number.isFinite(parsed) ? parsed : 50, 1, 100);
    }
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

/**
 * Does this workspace have the daily check budget for the monitor set it is
 * asking for?
 *
 * Replaces the plan paywall's two separate gates — a monitor count and an
 * interval floor — with the single thing that actually costs money. A donor
 * can spend their budget on many slow monitors or a few fast ones; the old
 * model charged the same for a 5-second check and a daily one, which differ
 * by a factor of 17,280.
 *
 * `prospective` is the set *after* the change, so create and edit are the same
 * question. Pass the existing monitor's id in `replacing` on an edit, or its
 * old cost is counted twice.
 */
export function assertFitsBudget(
  credit: OrgCredit,
  existingMonitors: Monitor[],
  incoming: { intervalSeconds: number; enabled: boolean },
  replacing?: string,
  now = Date.now()
): void {
  const others = existingMonitors.filter((m) => m.id !== replacing);

  const maxMonitors = maxMonitorsFor(credit, now);
  if (others.length + 1 > maxMonitors) {
    // 402, not 403: this is a "support the project and it lifts" limit rather
    // than a permission the customer can never have.
    throw new ValidationError(
      maxMonitors === MAX_MONITORS_DONOR
        ? `A workspace is capped at ${MAX_MONITORS_DONOR} monitors.`
        : `A free workspace is capped at ${MAX_MONITORS_FREE} monitors. ` +
          `Supporting the project raises it to ${MAX_MONITORS_DONOR}.`,
      402
    );
  }

  const verdict = fitsBudget(credit, [...others, incoming], now);
  if (!verdict.ok) {
    throw new ValidationError(verdict.reason!, 402);
  }
}

/** What one monitor costs, for showing the price before it is saved. */
export const monitorCostPerDay = checksPerDay;
