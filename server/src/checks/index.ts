import { checkHttp } from "./http.js";
import { checkTcp } from "./tcp.js";
import { checkDns } from "./dns.js";
import { checkSsl } from "./ssl.js";
import { checkIcmp } from "./icmp.js";
import type { CheckResult, Monitor, ProbeRegion } from "../types.js";

/** Runs the right probe for a monitor type. Never throws — always resolves. */
export async function runProbe(
  monitor: Monitor,
  region: ProbeRegion
): Promise<CheckResult> {
  try {
    switch (monitor.type) {
      case "http":
      case "keyword":
        return await checkHttp(monitor, region);
      case "tcp":
        return await checkTcp(monitor, region);
      case "dns":
        return await checkDns(monitor, region);
      case "ssl":
        return await checkSsl(monitor, region);
      case "icmp":
        return await checkIcmp(monitor, region);
      case "heartbeat":
        // Heartbeat monitors are evaluated by the scheduler, not probed:
        // being due IS the failure, because each received ping pushes the
        // due time forward by the grace period.
        return {
          ok: true,
          responseTimeMs: 0,
          region,
          checkedAt: Date.now(),
        };
      default:
        return {
          ok: false,
          responseTimeMs: 0,
          error: `Unsupported monitor type: ${monitor.type}`,
          region,
          checkedAt: Date.now(),
        };
    }
  } catch (err) {
    return {
      ok: false,
      responseTimeMs: 0,
      error: (err as Error).message ?? "Probe crashed",
      region,
      checkedAt: Date.now(),
    };
  }
}

export { checkHttp, checkTcp, checkDns, checkSsl, checkIcmp };
