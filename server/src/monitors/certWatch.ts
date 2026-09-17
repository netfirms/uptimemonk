import type { Monitor } from "../types.js";

/**
 * Certificate expiry warnings.
 *
 * Separate from up/down on purpose. A certificate with nine days left serves
 * every visitor perfectly — the renewal is urgent, the outage is fictional —
 * so this raises its own event rather than driving the monitor DOWN, which is
 * what the SSL check used to do.
 *
 * Several thresholds rather than one, because one is either too early to act
 * on or too late to act calmly. The default mirrors what certificate
 * authorities themselves send: a month out, a fortnight, a week, and a last
 * call the day before.
 */

export const DEFAULT_ALERT_DAYS = [30, 14, 7, 1];
/** More than a handful is noise, and each one is a page. */
export const MAX_ALERT_THRESHOLDS = 6;

/** Highest first, deduped, clamped, and bounded in count. */
export function normaliseAlertDays(input: unknown, fallback?: number): number[] {
  const raw = Array.isArray(input)
    ? input
    : typeof fallback === "number"
      ? [fallback]
      : DEFAULT_ALERT_DAYS;

  const cleaned = [
    ...new Set(
      raw
        .map((n) => Math.trunc(Number(n)))
        .filter((n) => Number.isFinite(n) && n >= 1 && n <= 365)
    ),
  ].sort((a, b) => b - a);

  return cleaned.length ? cleaned.slice(0, MAX_ALERT_THRESHOLDS) : DEFAULT_ALERT_DAYS;
}

/** The thresholds configured for a monitor, honouring the old single field. */
export const alertDaysFor = (m: Pick<Monitor, "sslExpiryAlertDays" | "sslExpiryWarningDays">) =>
  normaliseAlertDays(m.sslExpiryAlertDays, m.sslExpiryWarningDays);

export interface CertDecision {
  /** Thresholds newly crossed, highest first. Empty means say nothing. */
  fire: number[];
  /** What to persist as already-announced for this certificate. */
  alertedDays: number[];
  /** The expiry those alerts belong to. */
  basis: number;
  /** True when the certificate changed — a renewal, so warnings start over. */
  renewed: boolean;
}

/**
 * Which warnings are due.
 *
 * Fires the *lowest* crossed threshold only, not every one below the current
 * day count. A monitor first observed at four days left should say "4 days",
 * once — not deliver 30, 14 and 7 in the same breath because all three are
 * technically behind it.
 *
 * A renewal is detected by the expiry moving, which clears the record so the
 * new certificate announces its own thresholds. Comparing the date rather
 * than the fingerprint means a re-issue with the same key still counts.
 */
export function decideCertAlerts(
  monitor: Pick<
    Monitor,
    "sslExpiryAlertDays" | "sslExpiryWarningDays" | "certAlertedDays" | "certAlertBasis"
  >,
  expiresAt: number,
  now = Date.now()
): CertDecision {
  const thresholds = alertDaysFor(monitor);
  const daysLeft = Math.floor((expiresAt - now) / 86_400_000);

  const renewed = monitor.certAlertBasis != null && monitor.certAlertBasis !== expiresAt;
  const already = renewed ? [] : (monitor.certAlertedDays ?? []);

  const crossed = thresholds.filter((t) => daysLeft <= t && !already.includes(t));
  // Lowest crossed threshold is the honest one: it is the closest description
  // of how long is actually left.
  const fire = crossed.length ? [Math.min(...crossed)] : [];

  return {
    fire,
    // Everything at or above what we just said is now spoken for, so passing
    // 14 later cannot re-announce 30.
    alertedDays: [...new Set([...already, ...crossed])].sort((a, b) => b - a),
    basis: expiresAt,
    renewed,
  };
}

export function certCause(daysLeft: number, issuer?: string): string {
  const when =
    daysLeft <= 0
      ? "expires today"
      : daysLeft === 1
        ? "expires tomorrow"
        : `expires in ${daysLeft} days`;
  return issuer ? `Certificate ${when} (issued by ${issuer})` : `Certificate ${when}`;
}
