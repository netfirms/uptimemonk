import { execFile } from "node:child_process";
import { assertPublicHost, hostFromTarget } from "../lib/targetGuard.js";
import type { CheckResult, Monitor, ProbeRegion } from "../types.js";

/**
 * Real ICMP echo — the check Cloud Functions could not perform at any price,
 * because the runtime does not grant raw-socket access.
 *
 * Node has no raw-socket API, so this shells out to the system `ping`. That is
 * not a compromise: it avoids giving the Node process CAP_NET_RAW at all.
 * Modern `ping` uses an unprivileged ICMP datagram socket when the kernel
 * permits it, which the deploy script enables with
 *
 *   net.ipv4.ping_group_range = 0 2147483647
 *
 * Preferring that sysctl over `AmbientCapabilities=CAP_NET_RAW` keeps the
 * service running with no capabilities whatsoever, and keeps
 * `NoNewPrivileges=true` in the unit file — which would otherwise block the
 * setuid path `ping` falls back to.
 *
 * Arguments are passed as an array to execFile, never through a shell, and the
 * host is validated first: this is the one probe that hands a customer-supplied
 * string to another process.
 */
export async function checkIcmp(
  monitor: Monitor,
  region: ProbeRegion
): Promise<CheckResult> {
  const started = Date.now();
  const host = hostFromTarget(monitor.target);
  const timeoutSeconds = Math.max(1, Math.min(30, monitor.timeoutSeconds || 10));

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
    execFile(
      "ping",
      ["-c", "1", "-n", "-W", String(timeoutSeconds), "--", host],
      { timeout: (timeoutSeconds + 2) * 1000, killSignal: "SIGKILL" },
      (err, stdout) => {
        const elapsed = Date.now() - started;
        if (err) {
          return resolve({
            ok: false,
            responseTimeMs: elapsed,
            // "No reply" is ambiguous between a host that is down and one
            // that simply drops ICMP — which most CDNs and cloud load
            // balancers do by default. Saying so turns a confusing red
            // monitor into an obvious "use an HTTP check instead".
            error:
              /unknown host|Name or service not known/i.test(stdout)
                ? "DNS lookup failed (host not found)"
                : `No ICMP reply within ${timeoutSeconds}s — the host may be down, ` +
                  `or may block ping (common behind a CDN; try an HTTP check)`,
            region,
            checkedAt: started,
          });
        }

        // Prefer ping's own round-trip figure over our wall clock, which
        // includes process spawn time and would inflate every reading.
        const match = stdout.match(/time[=<]\s*([\d.]+)\s*ms/i);
        const rtt = match ? Math.round(Number(match[1])) : elapsed;

        resolve({
          ok: true,
          responseTimeMs: rtt,
          meta: { source: "icmp" },
          region,
          checkedAt: started,
        });
      }
    );
  });
}
