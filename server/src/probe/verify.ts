import { createHmac, timingSafeEqual } from "node:crypto";
import { runProbe } from "../checks/index.js";
import { log } from "../lib/log.js";
import { REGION, USER_AGENT, VERIFY_PEER_URL, VERIFY_SECRET } from "../config.js";
import type { Monitor } from "../types.js";

/**
 * Cross-region failure confirmation between two boxes.
 *
 * The primary probes; on failure it asks the peer for a second opinion over
 * HTTPS. Only a failure both regions see becomes an incident. This replaces
 * the Cloud Tasks verify hop and keeps the behaviour the state machine already
 * expects — no shared queue, no distributed lock, just one request.
 *
 * The request is HMAC-signed because the endpoint makes us probe an
 * arbitrary host on the caller's behalf. Without a signature, anyone who finds
 * the URL gets a free SSRF proxy with our IP as the source.
 */

export type Confirmation = "confirmed" | "healthy" | "unavailable";

function sign(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

/** Constant-time compare that cannot throw on a length mismatch. */
export function signatureMatches(body: string, secret: string, provided: string): boolean {
  if (!secret || !provided) return false;
  const expected = sign(body, secret);
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(provided, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Ask the peer to check this monitor. Returns "unavailable" when there is no
 * peer or it cannot be reached — the caller then trusts its own result, which
 * is the safe default: a missing second opinion must never suppress a real
 * outage.
 */
export async function verifyWithPeer(monitor: Monitor): Promise<Confirmation> {
  if (!VERIFY_PEER_URL || !VERIFY_SECRET) return "unavailable";

  const body = JSON.stringify({ monitorId: monitor.id, from: REGION, at: Date.now() });

  try {
    const res = await fetch(`${VERIFY_PEER_URL.replace(/\/$/, "")}/internal/verify`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": USER_AGENT,
        "x-uptimemonk-signature": sign(body, VERIFY_SECRET),
      },
      body,
      signal: AbortSignal.timeout(20_000),
    });

    if (!res.ok) {
      log.warn({ status: res.status, monitorId: monitor.id }, "peer verify rejected");
      return "unavailable";
    }
    const data = (await res.json()) as { ok?: boolean };
    return data.ok ? "healthy" : "confirmed";
  } catch (err) {
    log.warn({ err, monitorId: monitor.id }, "peer verify unreachable");
    return "unavailable";
  }
}

/** The peer side: probe on request and report, without recording anything. */
export async function handleVerifyRequest(monitor: Monitor): Promise<boolean> {
  const result = await runProbe(monitor, REGION);
  return result.ok;
}
