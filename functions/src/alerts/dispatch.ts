import { onTaskDispatched } from "firebase-functions/v2/tasks";
import { logger } from "firebase-functions";
import { Timestamp } from "firebase-admin/firestore";
import { col } from "../lib/firestore";
import { deliver, type AlertPayload } from "./channels";
import {
  PRIMARY_REGION,
  RESEND_API_KEY,
  TELEGRAM_BOT_TOKEN,
} from "../config";
import type { AlertContact, AlertTask, Incident, Monitor } from "../types";

/**
 * Fan-out of one incident to every alert contact on the monitor.
 *
 * Runs on its own Cloud Tasks queue so that a wedged Slack webhook cannot slow
 * down checking, and so each delivery retries independently with backoff.
 */
export const sendAlerts = onTaskDispatched<AlertTask>(
  {
    region: PRIMARY_REGION,
    secrets: [RESEND_API_KEY, TELEGRAM_BOT_TOKEN],
    memory: "256MiB",
    timeoutSeconds: 60,
    retryConfig: { maxAttempts: 5, minBackoffSeconds: 10, maxBackoffSeconds: 300 },
    rateLimits: { maxConcurrentDispatches: 30 },
  },
  async (req) => {
    const { monitorId, incidentId, event } = req.data;

    const [monitorSnap, incidentSnap] = await Promise.all([
      col.monitor(monitorId).get(),
      col.incidents().doc(incidentId).get(),
    ]);
    if (!monitorSnap.exists || !incidentSnap.exists) {
      logger.warn("sendAlerts: monitor or incident missing", { monitorId, incidentId });
      return;
    }

    const monitor = monitorSnap.data() as Monitor;
    const incident = incidentSnap.data() as Incident;
    const payload: AlertPayload = { event, monitor, monitorId, incident, incidentId };

    const ids = monitor.alertContactIds ?? [];
    if (!ids.length) {
      logger.info("sendAlerts: monitor has no alert contacts", { monitorId });
      return;
    }

    // Firestore `in` queries cap at 30 values, so chunk.
    const contacts: Array<{ id: string; contact: AlertContact }> = [];
    for (let i = 0; i < ids.length; i += 30) {
      const chunk = ids.slice(i, i + 30);
      const snap = await col
        .alertContacts()
        .where("__name__", "in", chunk.map((id) => col.alertContacts().doc(id)))
        .get();
      snap.docs.forEach((d) =>
        contacts.push({ id: d.id, contact: d.data() as AlertContact })
      );
    }

    const secrets = {
      resendKey: RESEND_API_KEY.value(),
      telegramToken: TELEGRAM_BOT_TOKEN.value(),
    };

    const results = await Promise.allSettled(
      contacts
        .filter(({ contact }) => contact.enabled && contact.verified)
        .map(async ({ id, contact }) => {
          await deliver(contact, payload, secrets);
          return id;
        })
    );

    const failures = results.filter((r) => r.status === "rejected");
    // Audit trail — customers ask "did you actually alert me?" all the time.
    await col.notifications().add({
      orgId: monitor.orgId,
      monitorId,
      incidentId,
      event,
      sentAt: Timestamp.now(),
      delivered: results.length - failures.length,
      failed: failures.length,
      errors: failures.map((f) => (f as PromiseRejectedResult).reason?.message ?? "error"),
    });

    if (failures.length) {
      // Throwing makes Cloud Tasks retry the whole fan-out. Fine at this size;
      // split per-contact tasks if duplicate sends ever become a problem.
      throw new Error(`${failures.length}/${results.length} alert deliveries failed`);
    }
  }
);
