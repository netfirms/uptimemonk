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

  const packetCount = Math.max(1, Math.min(5, monitor.icmpPacketCount ?? 1));
  const maxLossPercent = monitor.icmpMaxLossPercent ?? 100;

  const waitArg = process.platform === "darwin" ? String(timeoutSeconds * 1000) : String(timeoutSeconds);

  return new Promise<CheckResult>((resolve) => {
    execFile(
      "ping",
      ["-c", String(packetCount), "-n", "-W", waitArg, "--", host],
      { timeout: (timeoutSeconds + 4) * 1000, killSignal: "SIGKILL" },
      (err, stdout) => {
        const elapsed = Date.now() - started;
        const lossMatch = stdout.match(/([\d.]+)%\s*packet loss/i);
        const packetLoss = lossMatch ? parseFloat(lossMatch[1]) : err ? 100 : 0;

        if (err && packetLoss >= 100) {
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
            meta: { source: "icmp", packetLossPercent: 100, packetCount },
            region,
            checkedAt: started,
          });
        }

        // Parse round-trip stats: min/avg/max
        const rttStatsMatch = stdout.match(/(?:rtt|round-trip)\s+min\/avg\/max\/(?:mdev|stddev)\s*=\s*([\d.]+)\/([\d.]+)\/([\d.]+)/i);
        let minRtt: number | undefined;
        let avgRtt: number | undefined;
        let maxRtt: number | undefined;

        if (rttStatsMatch) {
          minRtt = Math.round(Number(rttStatsMatch[1]));
          avgRtt = Math.round(Number(rttStatsMatch[2]));
          maxRtt = Math.round(Number(rttStatsMatch[3]));
        } else {
          const match = stdout.match(/time[=<]\s*([\d.]+)\s*ms/i);
          avgRtt = match ? Math.round(Number(match[1])) : elapsed;
        }

        const lossExceeded = packetLoss > maxLossPercent;
        const ok = !lossExceeded && packetLoss < 100;

        resolve({
          ok,
          responseTimeMs: avgRtt ?? elapsed,
          error: ok
            ? undefined
            : `Packet loss ${packetLoss}% exceeded threshold of ${maxLossPercent}%`,
          meta: {
            source: "icmp",
            packetLossPercent: packetLoss,
            packetCount,
            minMs: minRtt,
            avgMs: avgRtt,
            maxMs: maxRtt,
          },
          region,
          checkedAt: started,
        });
      }
    );
  });
}
