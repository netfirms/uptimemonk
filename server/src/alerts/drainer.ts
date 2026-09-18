import { deliver, type AlertPayload } from "./channels.js";
import {
  dueOutbox,
  getContact,
  getIncident,
  getMonitor,
  markOutboxFailed,
  markOutboxSent,
} from "../db/repo.js";
import { log } from "../lib/log.js";
import {
  ALERT_FROM_EMAIL,
  MAILGUN_API_KEY,
  MAILGUN_BASE_URL,
  MAILGUN_DOMAIN, RESEND_API_KEY, TELEGRAM_BOT_TOKEN,
} from "../config.js";

/**
 * Drains the alert outbox.
 *
 * Deliberately separate from the probe path. The prober writes the incident
 * and its outbox rows in one transaction and moves on; this loop does the
 * network I/O. That separation is what makes "we detected an outage but never
 * told anyone" impossible — the intent is durable before any delivery is
 * attempted, and a crash mid-send simply retries.
 */

let timer: NodeJS.Timeout | null = null;
let draining = false;

async function drainOnce(): Promise<void> {
  if (draining) return; // never overlap: a slow webhook must not fan out
  draining = true;

  try {
    const rows = dueOutbox(Date.now(), 25);
    for (const row of rows) {
      const incident = getIncident(row.incidentId);
      const contact = getContact(row.contactId);
      const monitor = incident ? getMonitor(incident.monitorId) : null;

      if (!incident || !contact || !monitor) {
        markOutboxFailed(row.id, 99, "incident, contact or monitor no longer exists");
        continue;
      }

      // An unverified contact is not a delivery failure — it is a contact that
      // has never proved it wants mail from us. Drop it rather than retrying.
      if (!contact.enabled || !contact.verified) {
        markOutboxFailed(row.id, 99, `contact ${contact.id} is disabled or unverified`);
        log.info(
          { contactId: contact.id, verified: contact.verified },
          "skipping alert to unverified contact"
        );
        continue;
      }

      const payload: AlertPayload = {
        event: row.event,
        monitor,
        monitorId: monitor.id,
        incident,
        incidentId: incident.id,
      };

      try {
        await deliver(contact, payload, {
          mailgunKey: MAILGUN_API_KEY,
          mailgunDomain: MAILGUN_DOMAIN,
          mailgunBaseUrl: MAILGUN_BASE_URL,
          from: ALERT_FROM_EMAIL,
          resendKey: RESEND_API_KEY,
          telegramToken: TELEGRAM_BOT_TOKEN,
        });
        markOutboxSent(row.id);
        log.info(
          { contactId: contact.id, channel: contact.channel, event: row.event },
          "alert delivered"
        );
      } catch (err) {
        const message = (err as Error).message ?? "delivery failed";
        const isFcmExpired =
          contact.channel === "fcm" &&
          (message.includes("registration-token-not-registered") ||
            message.includes("invalid-registration-token") ||
            message.includes("Requested entity was not found"));

        if (isFcmExpired) {
          markOutboxFailed(row.id, 99, `FCM device token expired: ${message}`);
          log.warn({ contactId: contact.id }, "FCM token unregistered or invalid, dropping");
        } else {
          markOutboxFailed(row.id, row.attempts, message);
          log.warn(
            { err, contactId: contact.id, attempts: row.attempts + 1 },
            "alert delivery failed, will retry"
          );
        }
      }
    }
  } catch (err) {
    log.error({ err }, "outbox drain failed");
  } finally {
    draining = false;
  }
}

export function startDrainer(intervalMs = 2_000): void {
  if (timer) return;
  timer = setInterval(() => void drainOnce(), intervalMs);
  timer.unref();
}

export function stopDrainer(): void {
  if (timer) clearInterval(timer);
  timer = null;
}

export { drainOnce };
