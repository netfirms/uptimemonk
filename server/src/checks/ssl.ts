import tls from "node:tls";
import { assertPublicHost, hostFromTarget } from "../lib/targetGuard.js";
import type { CheckResult, Monitor, ProbeRegion } from "../types.js";

/**
 * TLS certificate check: is the chain valid, and how many days until expiry.
 *
 * **Approaching expiry is not a failure.** A certificate with nine days left
 * serves every visitor perfectly; the renewal is urgent, the outage is
 * fictional. This used to return `ok: false` inside the warning window, which
 * drove the monitor DOWN, opened an outage incident and paged people about a
 * site that was working. Expiry warnings are now their own event with their
 * own thresholds — see `monitors/certWatch.ts`.
 *
 * What genuinely fails: an expired certificate, an untrusted chain, a
 * fingerprint that does not match the pin, a protocol below the required
 * minimum, and any handshake that does not complete. Those all mean a real
 * visitor is seeing a real error.
 */
export async function checkSsl(
  monitor: Monitor,
  region: ProbeRegion
): Promise<CheckResult> {
  const started = Date.now();
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
        const protocol = socket.getProtocol() || "unknown";
        const fingerprint256 = cert.fingerprint256;

        // `valid_from` as well as `valid_to`: the UI shows a validity window,
        // and "issued 3 days ago" is how you spot a renewal that worked.
        const issuedAt = cert.valid_from ? new Date(cert.valid_from).getTime() : undefined;

        const meta = {
          expiresAt,
          issuedAt: Number.isFinite(issuedAt) ? issuedAt : undefined,
          daysLeft,
          issuer: cert.issuer?.O,
          subject: cert.subject?.CN,
          fingerprint256,
          protocol,
        };

        if (!authorized) {
          return finish({
            ok: false,
            error: `Certificate not trusted: ${socket.authorizationError}`,
            meta,
          });
        }

        // Fingerprint pinning verification
        if (monitor.sslExpectedFingerprint && fingerprint256) {
          const normExpected = monitor.sslExpectedFingerprint.replace(/[:\s]/g, "").toUpperCase();
          const normActual = fingerprint256.replace(/[:\s]/g, "").toUpperCase();
          if (normExpected !== normActual) {
            return finish({
              ok: false,
              error: `Certificate fingerprint mismatch: expected ${monitor.sslExpectedFingerprint}, got ${fingerprint256}`,
              meta,
            });
          }
        }

        // Minimum TLS version verification
        if (monitor.sslMinVersion) {
          const isTls13 = protocol === "TLSv1.3";
          const isTls12 = protocol === "TLSv1.2";
          if (monitor.sslMinVersion === "TLSv1.3" && !isTls13) {
            return finish({
              ok: false,
              error: `Negotiated protocol ${protocol} does not meet minimum ${monitor.sslMinVersion}`,
              meta,
            });
          }
          if (monitor.sslMinVersion === "TLSv1.2" && !isTls12 && !isTls13) {
            return finish({
              ok: false,
              error: `Negotiated protocol ${protocol} does not meet minimum ${monitor.sslMinVersion}`,
              meta,
            });
          }
        }

        // Expired is a real failure: browsers refuse the connection.
        if (daysLeft < 0) {
          return finish({
            ok: false,
            error: `Certificate expired ${Math.abs(daysLeft)} days ago`,
            meta,
          });
        }

        // Still valid. Any threshold warning is raised from `meta` by
        // certWatch, without touching the monitor's up/down state.
        return finish({ ok: true, meta });
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
