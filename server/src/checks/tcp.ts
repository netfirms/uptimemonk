import net from "node:net";
import { assertPublicHost, hostFromTarget } from "../lib/targetGuard.js";
import type { CheckResult, Monitor, ProbeRegion } from "../types.js";

/**
 * TCP connect check ("port monitoring").
 *
 * Note: this is also how we approximate "ping". Cloud Run / Cloud Functions do
 * not grant CAP_NET_RAW, so real ICMP echo is not possible from a serverless
 * probe. A TCP handshake against a known-open port is the standard substitute;
 * if you need true ICMP, run a probe on a Compute Engine e2-micro and have it
 * post results back to the same task queue.
 */
export async function checkTcp(
  monitor: Monitor,
  region: ProbeRegion
): Promise<CheckResult> {
  const started = Date.now();
  const port = monitor.port ?? 443;
  const timeoutMs = Math.max(1, monitor.timeoutSeconds) * 1000;
  const host = hostFromTarget(monitor.target);

  // A raw socket to an arbitrary host:port is the widest SSRF surface here —
  // validate before connecting, not after.
  try {
    await assertPublicHost(host);
  } catch (err) {
    return {
      ok: false,
      responseTimeMs: Date.now() - started,
      error: (err as Error).message,
      region,
      checkedAt: started,
    };
  }

  return new Promise<CheckResult>((resolve) => {
    let settled = false;
    const finish = (ok: boolean, error?: string) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve({
        ok,
        responseTimeMs: Date.now() - started,
        error,
        region,
        checkedAt: started,
      });
    };

    const socket = net.createConnection({ host, port });
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () =>
      finish(false, `Timed out after ${monitor.timeoutSeconds}s`)
    );
    socket.once("error", (err: NodeJS.ErrnoException) =>
      finish(false, `${err.code ?? "Error"}: connect to ${monitor.target}:${port} failed`)
    );
  });
}
