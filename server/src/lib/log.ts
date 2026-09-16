import pino from "pino";

/**
 * Structured JSON to stdout, captured by systemd. `journalctl -u
 * uptimemonk-worker -f` is the whole operational story until volume justifies
 * shipping logs anywhere.
 *
 * Redaction is not decoration here: probe errors quote URLs, and a monitor's
 * target can legitimately carry a token in a query string.
 */
export const log = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: {
    paths: [
      "req.headers.authorization",
      "headers.authorization",
      "*.password",
      "*.token",
      "*.apiKey",
    ],
    censor: "[redacted]",
  },
  base: { svc: process.env.UPTIMEMONK_SVC ?? "uptimemonk" },
});
