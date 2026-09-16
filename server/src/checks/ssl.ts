import tls from "node:tls";
import { assertPublicHost, hostFromTarget } from "../lib/targetGuard.js";
import type { CheckResult, Monitor, ProbeRegion } from "../types.js";

/**
 * TLS certificate check: is the chain valid, and how many days until expiry.
 * Fails when the cert is invalid, or when expiry is closer than the monitor's
 * warning threshold (default 14 days) — that is the alert customers want.
 */
export async function checkSsl(
  monitor: Monitor,
  region: ProbeRegion
): Promise<CheckResult> {
  const started = Date.now();
  const warnDays = monitor.sslExpiryWarningDays ?? 14;
  const host = hostFromTarget(monitor.target);
  const port = monitor.port ?? 443;
  const timeoutMs = Math.max(1, monitor.timeoutSeconds) * 1000;

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
    const finish = (r: Omit<CheckResult, "region" | "checkedAt" | "responseTimeMs">) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve({
        ...r,
        responseTimeMs: Date.now() - started,
        region,
        checkedAt: started,
      });
    };

    const socket = tls.connect(
      { host, port, servername: host, timeout: timeoutMs },
      () => {
        const cert = socket.getPeerCertificate();
        if (!cert || !cert.valid_to) {
          return finish({ ok: false, error: "No certificate presented" });
        }
        const expiresAt = new Date(cert.valid_to).getTime();
        const daysLeft = Math.floor((expiresAt - Date.now()) / 86_400_000);
        const authorized = socket.authorized;

        if (!authorized) {
          return finish({
            ok: false,
            error: `Certificate not trusted: ${socket.authorizationError}`,
            meta: { expiresAt, daysLeft, issuer: cert.issuer?.O },
          });
        }
        if (daysLeft < warnDays) {
          return finish({
            ok: false,
            error:
              daysLeft < 0
                ? `Certificate expired ${Math.abs(daysLeft)} days ago`
                : `Certificate expires in ${daysLeft} days`,
            meta: { expiresAt, daysLeft, issuer: cert.issuer?.O },
          });
        }
        return finish({
          ok: true,
          meta: { expiresAt, daysLeft, issuer: cert.issuer?.O },
        });
      }
    );

    socket.once("timeout", () =>
      finish({ ok: false, error: `TLS handshake timed out after ${monitor.timeoutSeconds}s` })
    );
    socket.once("error", (err: NodeJS.ErrnoException) =>
      finish({ ok: false, error: `TLS error: ${err.code ?? err.message}` })
    );
  });
}
