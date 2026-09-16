import { Resolver } from "node:dns/promises";
import type { CheckResult, Monitor, ProbeRegion } from "../types.js";

/**
 * DNS record check. Uses an explicit resolver (Cloudflare + Google) rather than
 * the container's resolver, so results are consistent across probe regions and
 * not served from the metadata server's cache.
 */
export async function checkDns(
  monitor: Monitor,
  region: ProbeRegion
): Promise<CheckResult> {
  const started = Date.now();
  const resolver = new Resolver({ timeout: monitor.timeoutSeconds * 1000, tries: 1 });
  resolver.setServers(["1.1.1.1", "8.8.8.8"]);

  const host = monitor.target.replace(/^\w+:\/\//, "").split("/")[0];
  const type = monitor.dnsRecordType ?? "A";

  try {
    let values: string[] = [];
    switch (type) {
      case "A":
        values = await resolver.resolve4(host);
        break;
      case "AAAA":
        values = await resolver.resolve6(host);
        break;
      case "CNAME":
        values = await resolver.resolveCname(host);
        break;
      case "NS":
        values = await resolver.resolveNs(host);
        break;
      case "TXT":
        values = (await resolver.resolveTxt(host)).map((chunks) => chunks.join(""));
        break;
      case "MX":
        values = (await resolver.resolveMx(host)).map(
          (r) => `${r.priority} ${r.exchange}`
        );
        break;
    }

    const expected = monitor.dnsExpectedValue?.trim();
    const ok = !expected || values.some((v) => v.includes(expected));

    return {
      ok,
      responseTimeMs: Date.now() - started,
      error: ok
        ? undefined
        : `Expected ${type} record to contain "${expected}", got ${values.join(", ") || "nothing"}`,
      meta: { values, type },
      region,
      checkedAt: started,
    };
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    return {
      ok: false,
      responseTimeMs: Date.now() - started,
      error: `DNS ${type} lookup failed: ${e.code ?? e.message}`,
      region,
      checkedAt: started,
    };
  }
}
