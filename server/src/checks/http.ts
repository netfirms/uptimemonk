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
    const wantsBody = monitor.type === "keyword";

    // A keyword check reads the body, and a HEAD response has none — so HEAD
    // here is not a preference, it is a guaranteed false outage. Enforced at
    // the probe rather than only in validation, because stored config can
    // predate the rule and a monitor must not be able to report a permanent
    // failure for a reason no one can see.
    let method = wantsBody
      ? monitor.method === "POST"
        ? "POST"
        : "GET"
      : (monitor.method ?? "HEAD");
    let body = method === "POST" ? monitor.requestBody : undefined;
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
        if (method === "POST") {
          method = wantsBody ? "GET" : "HEAD";
          body = undefined;
        }
      }
    }

    const responseTimeMs = Date.now() - started;
    const codeOk = statusMatches(res.status, monitor.acceptedStatusCodes);

    if (!wantsBody) {
      return {
        ok: codeOk,
        responseTimeMs,
        statusCode: res.status,
        error: codeOk ? undefined : `Unexpected status ${res.status}`,
        region,
        checkedAt: started,
      };
    }

    // Keyword monitors need the body. Cap it so a huge page can't blow memory.
    const text = (await res.text()).slice(0, 512 * 1024);
    // Case-insensitive unless the monitor explicitly asks otherwise.
    //
    // This was a plain `includes`, which meant a monitor looking for
    // "AGARWOOD OIL" never matched a page saying "Agarwood Oil" — reported as
    // a hard outage with no hint that casing was the reason. A false outage is
    // worse than a missed one: it trains people to ignore the alerts.
    const found = monitor.keyword
      ? monitor.keywordCaseSensitive
        ? text.includes(monitor.keyword)
        : text.toLowerCase().includes(monitor.keyword.toLowerCase())
      : true;
    const wanted = monitor.keywordInverted ? !found : found;
    const ok = codeOk && wanted;

    return {
      ok,
      responseTimeMs,
      statusCode: res.status,
      error: ok
        ? undefined
        : !codeOk
          ? `Unexpected status ${res.status}`
          : monitor.keywordInverted
            ? `Keyword "${monitor.keyword}" was present`
            : `Keyword "${monitor.keyword}" not found`,
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
