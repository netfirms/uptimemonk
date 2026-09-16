import {
  ALERT_FROM_EMAIL,
  MAILGUN_API_KEY,
  MAILGUN_DOMAIN,
  HEARTBEAT_URL,
  RESEND_API_KEY,
  TELEGRAM_BOT_TOKEN,
  VERIFY_PEER_URL,
  VERIFY_SECRET,
  WORKER_COUNT,
} from "../config.js";

/**
 * Configuration that is optional to start but not optional to work.
 *
 * The failure mode this exists to prevent: a worker boots, reports healthy,
 * checks everything on schedule — and cannot deliver a single alert, because
 * one environment variable is blank. Everything upstream succeeds, so nothing
 * looks wrong until an outage goes unreported.
 *
 * These are surfaced at startup and on /healthz rather than raised as errors:
 * refusing to boot would turn a degraded monitor into no monitor, which is
 * worse. But they must be loud.
 */

export type Severity = "critical" | "warning";

export interface ReadinessIssue {
  key: string;
  severity: Severity;
  detail: string;
}

export function readinessIssues(): ReadinessIssue[] {
  const issues: ReadinessIssue[] = [];

  if (!MAILGUN_API_KEY && !RESEND_API_KEY) {
    issues.push({
      key: "MAILGUN_API_KEY / RESEND_API_KEY",
      severity: "critical",
      detail:
        "No email provider is configured, so no email alert can be delivered. " +
        "Checks still run and incidents are still recorded, but nobody is told " +
        "about them.",
    });
  }

  // A From address off the Mailgun sending domain authenticates as a different
  // domain, so SPF and DKIM do not cover it and DMARC-enforcing receivers bin
  // it. Mail that silently lands in spam is the same failure as mail that is
  // never sent, and harder to notice.
  if (MAILGUN_API_KEY && MAILGUN_DOMAIN) {
    const fromDomain = ALERT_FROM_EMAIL.split("@")[1]?.toLowerCase() ?? "";
    const sending = MAILGUN_DOMAIN.toLowerCase();
    if (fromDomain && fromDomain !== sending && !fromDomain.endsWith(`.${sending}`)) {
      issues.push({
        key: "ALERT_FROM_EMAIL",
        severity: "warning",
        detail:
          `ALERT_FROM_EMAIL is ${ALERT_FROM_EMAIL} but Mailgun sends as ` +
          `${MAILGUN_DOMAIN}. Alerts may be rejected or filtered as spam. ` +
          `Use an address on ${MAILGUN_DOMAIN}.`,
      });
    }
  }

  if (!HEARTBEAT_URL) {
    issues.push({
      key: "UPTIMEMONK_HEARTBEAT_URL",
      severity: "critical",
      detail:
        "No dead-man's switch. If this worker stops, the organisations it owns " +
        "stop being checked and nothing external notices.",
    });
  }

  // Only meaningful once there is more than one worker to confirm with.
  if (WORKER_COUNT > 1 && (!VERIFY_SECRET || !VERIFY_PEER_URL)) {
    issues.push({
      key: "VERIFY_SECRET / VERIFY_PEER_URL",
      severity: "warning",
      detail:
        "Cross-region confirmation is off, so a local network blip will be " +
        "reported as a customer outage.",
    });
  }

  if (!TELEGRAM_BOT_TOKEN) {
    issues.push({
      key: "TELEGRAM_BOT_TOKEN",
      severity: "warning",
      detail: "Telegram alert contacts will fail to deliver.",
    });
  }

  return issues;
}

export function readinessSummary() {
  const issues = readinessIssues();
  return {
    ok: issues.length === 0,
    critical: issues.filter((i) => i.severity === "critical").length,
    issues,
  };
}
