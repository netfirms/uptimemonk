import { fetch, type Dispatcher } from "undici";
import { USER_AGENT } from "../config.js";
import { probeAgent } from "../probe/agent.js";
import {
  BlockedTargetError,
  assertSafeUrl,
  sanitizeHeaders,
} from "../lib/targetGuard.js";
import type { CheckResult, Monitor, ProbeRegion } from "../types.js";

/** Redirect chains longer than this are a loop or an attempt to hide a hop. */
const MAX_REDIRECTS = 5;

const REDIRECT_CODES = new Set([301, 302, 303, 307, 308]);

function statusMatches(code: number, accepted?: string[]): boolean {
  const patterns = accepted?.length ? accepted : ["2xx", "3xx"];
  return patterns.some((p) => {
    const norm = p.trim().toLowerCase();
    if (/^\d{3}$/.test(norm)) return Number(norm) === code;
    if (/^\dxx$/.test(norm)) return Math.floor(code / 100) === Number(norm[0]);
    const range = norm.match(/^(\d{3})-(\d{3})$/);
    if (range) return code >= Number(range[1]) && code <= Number(range[2]);
    return false;
  });
}

/** Extracts a nested property value using dot-notation ("data.status" or "items.0.id"). */
export function getJsonPathValue(data: unknown, path: string): unknown {
  if (data === null || data === undefined) return undefined;
  const segments = path.trim().replace(/^(\$\.|\/)/, "").split(/[./]/);
  let current: unknown = data;
  for (const seg of segments) {
    if (!seg) continue;
    if (typeof current !== "object" || current === null) return undefined;
    current = (current as Record<string, unknown>)[seg];
  }
  return current;
}

/**
 * HTTP / keyword check. Uses Node 22's built-in fetch, so no extra deps and a
 * small cold start. Body is only read for keyword monitors.
 *
 * Redirects are followed by hand rather than by undici, because every hop has
 * to be re-validated: a target that passes the guard can still answer with
 * "302 -> http://169.254.169.254/", and undici would follow it happily.
 */
export async function checkHttp(
  monitor: Monitor,
  region: ProbeRegion
): Promise<CheckResult> {
  const started = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    Math.max(1, monitor.timeoutSeconds) * 1000
  );

  try {
    let url = await assertSafeUrl(monitor.target);
    const follow = monitor.followRedirects !== false;
    const wantsBody = monitor.type === "keyword" || !!monitor.jsonPath;

    // A keyword check reads the body, and a HEAD response has none — so HEAD
    // here is not a preference, it is a guaranteed false outage. Enforced at
    // the probe rather than only in validation, because stored config can
    // predate the rule and a monitor must not be able to report a permanent
    // failure for a reason no one can see.
    const BODY_METHODS = ["POST", "PUT", "PATCH", "DELETE"];
    let method = wantsBody
      ? BODY_METHODS.includes(monitor.method ?? "")
        ? monitor.method!
        : "GET"
      : (monitor.method ?? "HEAD");
    let body = ["POST", "PUT", "PATCH"].includes(method) ? monitor.requestBody : undefined;
    let res: Awaited<ReturnType<typeof fetch>>;
    let hops = 0;

    for (;;) {
      res = await fetch(url, {
        method,
        dispatcher: probeAgent as Dispatcher,
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "user-agent": USER_AGENT,
          accept: "*/*",
          ...sanitizeHeaders(monitor.requestHeaders),
        },
        body,
      });

      const location = res.headers.get("location");
      if (!follow || !REDIRECT_CODES.has(res.status) || !location) break;

      if (++hops > MAX_REDIRECTS) {
        return {
          ok: false,
          responseTimeMs: Date.now() - started,
          statusCode: res.status,
          error: `Too many redirects (more than ${MAX_REDIRECTS})`,
          region,
          checkedAt: started,
        };
      }

      // Re-validate every hop, and follow the same method rules browsers use.
      url = await assertSafeUrl(new URL(location, url).toString());
      if (res.status === 301 || res.status === 302 || res.status === 303) {
        if (method === "POST" || method === "PUT" || method === "PATCH") {
          method = wantsBody ? "GET" : "HEAD";
          body = undefined;
        }
      }
    }

    const responseTimeMs = Date.now() - started;
    const codeOk = statusMatches(res.status, monitor.acceptedStatusCodes);
    const slaViolated =
      monitor.maxResponseTimeMs !== undefined &&
      monitor.maxResponseTimeMs > 0 &&
      responseTimeMs > monitor.maxResponseTimeMs;

    if (!wantsBody) {
      const ok = codeOk && !slaViolated;
      return {
        ok,
        responseTimeMs,
        statusCode: res.status,
        error: ok
          ? undefined
          : slaViolated
            ? `Response time ${responseTimeMs}ms exceeded SLA threshold of ${monitor.maxResponseTimeMs}ms`
            : `Unexpected status ${res.status}`,
        meta: { hops, ...(monitor.maxResponseTimeMs ? { slaThresholdMs: monitor.maxResponseTimeMs } : {}) },
        region,
        checkedAt: started,
      };
    }

    // Keyword & JSON monitors need the body. Cap it so a huge page can't blow memory.
    const text = (await res.text()).slice(0, 512 * 1024);

    let found = true;
    if (monitor.keyword) {
      if (monitor.keywordRegex) {
        try {
          const flags = monitor.keywordCaseSensitive ? "" : "i";
          const re = new RegExp(monitor.keyword, flags);
          found = re.test(text);
        } catch {
          found = false;
        }
      } else {
        found = monitor.keywordCaseSensitive
          ? text.includes(monitor.keyword)
          : text.toLowerCase().includes(monitor.keyword.toLowerCase());
      }
    }
    const wanted = monitor.keywordInverted ? !found : found;

    // JSON Path matching (if requested)
    let jsonPathOk = true;
    let jsonPathError: string | undefined;
    let jsonExtracted: unknown = undefined;
    if (monitor.jsonPath) {
      try {
        const parsed = JSON.parse(text);
        jsonExtracted = getJsonPathValue(parsed, monitor.jsonPath);
        if (jsonExtracted === undefined) {
          jsonPathOk = false;
          jsonPathError = `JSON path "${monitor.jsonPath}" not found in response`;
        } else if (monitor.jsonPathExpected !== undefined && monitor.jsonPathExpected !== "") {
          const actualStr = typeof jsonExtracted === "object" ? JSON.stringify(jsonExtracted) : String(jsonExtracted);
          if (actualStr !== String(monitor.jsonPathExpected)) {
            jsonPathOk = false;
            jsonPathError = `JSON path "${monitor.jsonPath}" expected "${monitor.jsonPathExpected}", got "${actualStr}"`;
          }
        }
      } catch (err) {
        jsonPathOk = false;
        jsonPathError = `Response is not valid JSON: ${(err as Error).message}`;
      }
    }

    const ok = codeOk && wanted && jsonPathOk && !slaViolated;
    let error: string | undefined = undefined;
    if (!ok) {
      if (!codeOk) {
        error = `Unexpected status ${res.status}`;
      } else if (slaViolated) {
        error = `Response time ${responseTimeMs}ms exceeded SLA threshold of ${monitor.maxResponseTimeMs}ms`;
      } else if (!wanted) {
        error = monitor.keywordInverted
          ? `Keyword "${monitor.keyword}" was present`
          : `Keyword "${monitor.keyword}" not found`;
      } else if (!jsonPathOk) {
        error = jsonPathError;
      }
    }

    return {
      ok,
      responseTimeMs,
      statusCode: res.status,
      error,
      meta: {
        hops,
        ...(monitor.maxResponseTimeMs ? { slaThresholdMs: monitor.maxResponseTimeMs } : {}),
        ...(monitor.jsonPath ? { jsonPath: monitor.jsonPath, jsonExtracted } : {}),
      },
      region,
      checkedAt: started,
    };
  } catch (err) {
    const responseTimeMs = Date.now() - started;
    if (err instanceof BlockedTargetError) {
      return {
        ok: false,
        responseTimeMs,
        error: err.message,
        region,
        checkedAt: started,
      };
    }
    const aborted = (err as Error)?.name === "AbortError";
    return {
      ok: false,
      responseTimeMs,
      error: aborted
        ? `Timed out after ${monitor.timeoutSeconds}s`
        : describeNetworkError(err),
      region,
      checkedAt: started,
    };
  } finally {
    clearTimeout(timeout);
  }
}

/** Turns undici's nested cause chain into something a customer can read. */
export function describeNetworkError(err: unknown): string {
  const e = err as { message?: string; cause?: { code?: string; message?: string } };
  const code = e?.cause?.code;
  const map: Record<string, string> = {
    ENOTFOUND: "DNS lookup failed (host not found)",
    ECONNREFUSED: "Connection refused",
    ECONNRESET: "Connection reset by peer",
    ETIMEDOUT: "Connection timed out",
    EHOSTUNREACH: "Host unreachable",
    CERT_HAS_EXPIRED: "TLS certificate has expired",
    DEPTH_ZERO_SELF_SIGNED_CERT: "Self-signed TLS certificate",
    UNABLE_TO_VERIFY_LEAF_SIGNATURE: "TLS certificate could not be verified",
    ERR_TLS_CERT_ALTNAME_INVALID: "TLS certificate does not match hostname",
  };
  if (code && map[code]) return map[code];
  return e?.cause?.message || e?.message || "Request failed";
}
