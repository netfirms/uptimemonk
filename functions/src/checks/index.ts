import { checkHttp } from "./http";
import { checkTcp } from "./tcp";
import { checkDns } from "./dns";
import { checkSsl } from "./ssl";
import type { CheckResult, Monitor, ProbeRegion } from "../types";

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
      case "heartbeat":
        // Heartbeat monitors are evaluated by the dispatcher, not probed.
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

export { checkHttp, checkTcp, checkDns, checkSsl };
