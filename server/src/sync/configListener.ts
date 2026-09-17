import { col } from "./firebase.js";
import {
  allMonitorIds,
  deleteMonitor,
  deleteContact,
  upsertContact,
  upsertMonitorConfig,
  upsertOrg,
} from "../db/repo.js";
import { initialDueAt } from "../scheduler/heap.js";
import { getDb } from "../db/index.js";
import { log } from "../lib/log.js";
import { getSeedableConfig } from "../config.js";
import { RECONCILE_MS, updateDynamicConfig } from "../config.js";
import type { AlertContact, Monitor } from "../types.js";

/**
 * Firebase → box. Configuration flows one way, via a realtime listener.
 *
 * This is why the design needs no message broker: Firestore already is the
 * durable log. A listener re-delivers the full set on reconnect, so an hour of
 * downtime costs nothing — the source of truth replays. A queue in front of
 * this would add a second place for monitor config to live, and reconciling
 * the drift between them is exactly how hybrid systems rot.
 */

type Unsubscribe = () => void;
const subscriptions: Unsubscribe[] = [];

/** Firestore Timestamp | Date | number → epoch ms. */
function ms(value: unknown, fallback = Date.now()): number {
  if (typeof value === "number") return value;
  if (value && typeof (value as any).toMillis === "function") {
    return (value as any).toMillis();
  }
  if (value instanceof Date) return value.getTime();
  return fallback;
}

function toMonitor(id: string, d: Record<string, unknown>): Monitor {
  const intervalSeconds = Number(d.intervalSeconds) || 300;
  return {
    id,
    orgId: String(d.orgId ?? ""),
    name: String(d.name ?? "Untitled"),
    type: (d.type as Monitor["type"]) ?? "http",
    target: String(d.target ?? ""),
    port: d.port as number | undefined,
    method: d.method as Monitor["method"],
    requestHeaders: d.requestHeaders as Record<string, string> | undefined,
    requestBody: d.requestBody as string | undefined,
    acceptedStatusCodes: d.acceptedStatusCodes as string[] | undefined,
    followRedirects: d.followRedirects as boolean | undefined,
    keyword: d.keyword as string | undefined,
    keywordInverted: d.keywordInverted as boolean | undefined,
    keywordCaseSensitive: d.keywordCaseSensitive as boolean | undefined,
    dnsRecordType: d.dnsRecordType as Monitor["dnsRecordType"],
    dnsExpectedValue: d.dnsExpectedValue as string | undefined,
    sslExpiryWarningDays: d.sslExpiryWarningDays as number | undefined,
    sslExpiryAlertDays: d.sslExpiryAlertDays as number[] | undefined,
    heartbeatToken: d.heartbeatToken as string | undefined,
    heartbeatGraceSeconds: d.heartbeatGraceSeconds as number | undefined,
    intervalSeconds,
    timeoutSeconds: Number(d.timeoutSeconds) || 10,
    confirmationThreshold: Number(d.confirmationThreshold) || 2,
    regions: (d.regions as Monitor["regions"]) ?? [],
    enabled: d.enabled !== false,
    // Absent means private: a monitor written before this field existed must
    // not appear on a public page just because the flag is missing.
    publicOnStatusPage: d.publicOnStatusPage === true,
    muteAlerts: d.muteAlerts === true,
    maintenanceWindows: (d.maintenanceWindows as Monitor["maintenanceWindows"]) ?? [],
    alertContactIds: (d.alertContactIds as string[]) ?? [],
    status: "pending",
    consecutiveFailures: 0,
    inMaintenance: false,
    dueAt: initialDueAt(id, intervalSeconds * 1000, Date.now()),
    createdAt: ms(d.createdAt),
    updatedAt: ms(d.updatedAt),
  };
}

function toContact(id: string, d: Record<string, unknown>): AlertContact {
  return {
    id,
    orgId: String(d.orgId ?? ""),
    channel: (d.channel as AlertContact["channel"]) ?? "email",
    name: String(d.name ?? ""),
    destination: String(d.destination ?? ""),
    telegramChatId: d.telegramChatId as string | undefined,
    enabled: d.enabled !== false,
    verified: d.verified === true,
  };
}

/**
 * Start both listeners. `onChange` is called with the ids that need
 * rescheduling, so the scheduler can react without re-reading the database.
 */
export function startConfigListener(onChange: (changed: string[], removed: string[]) => void): void {
  const monitors = col.monitors().onSnapshot(
    (snap) => {
      const changed: string[] = [];
      const removed: string[] = [];

      // docChanges() gives only the delta after the first snapshot, but on a
      // reconnect every document arrives as "added" again — so upsert must be
      // idempotent and must never reset live state. upsertMonitorConfig
      // deliberately excludes status, due_at and failure counts for exactly
      // this reason.
      for (const change of snap.docChanges()) {
        const id = change.doc.id;
        if (change.type === "removed") {
          deleteMonitor(id);
          removed.push(id);
          continue;
        }
        upsertMonitorConfig(toMonitor(id, change.doc.data()));
        changed.push(id);
      }

      if (changed.length || removed.length) {
        log.info({ changed: changed.length, removed: removed.length }, "config sync");
        onChange(changed, removed);
      }
    },
    (err) => log.error({ err }, "monitor listener error — reconcile will recover")
  );

  const contacts = col.alertContacts().onSnapshot(
    (snap) => {
      for (const change of snap.docChanges()) {
        if (change.type === "removed") deleteContact(change.doc.id);
        else upsertContact(toContact(change.doc.id, change.doc.data()));
      }
    },
    (err) => log.error({ err }, "contact listener error")
  );

  const systemConfig = col.system().doc("config").onSnapshot(
    (snap) => {
      if (snap.exists) {
        log.info("received live dynamic app configuration from Firestore");
        updateDynamicConfig(snap.data() as Record<string, unknown>);
      } else {
        updateDynamicConfig(null);
      }
    },
    (err) => log.error({ err }, "system config listener error")
  );

  subscriptions.push(monitors, contacts, systemConfig);
}

/**
 * Create `system/config` from the environment the first time, and only then.
 *
 * The admin console edits this document, and an empty one means filling every
 * field by hand to re-state what the worker is already running. Seeding it
 * from the live values makes the console show the truth on first open.
 *
 * Two rules. It **never overwrites** an existing document — an operator's
 * setting outranks an environment default, and a worker restart must not
 * quietly revert a change made through the console. And it never writes a
 * secret: `getSeedableConfig` strips them, because a credential in Firestore
 * is a second copy in a weaker place than the 0600 file it came from.
 */
export async function seedSystemConfig(): Promise<void> {
  const ref = col.system().doc("config");
  try {
    const existing = await ref.get();
    if (existing.exists) {
      log.debug("system config already present — leaving it alone");
      return;
    }

    await ref.create({
      ...getSeedableConfig(),
      seededAt: new Date().toISOString(),
      seededFrom: "worker environment",
    });
    log.info("seeded system config from the environment");
  } catch (err) {
    // A create that loses a race with another process is the correct outcome,
    // and nothing here is worth failing a boot over.
    log.warn({ err }, "could not seed system config — continuing");
  }
}

/**
 * Dedicated system config listener for processes that do not run full monitor sync (e.g. API).
 */
export function startSystemConfigListener(): () => void {
  return col.system().doc("config").onSnapshot(
    (snap) => {
      if (snap.exists) {
        log.info("api received live dynamic app configuration from Firestore");
        updateDynamicConfig(snap.data() as Record<string, unknown>);
      } else {
        updateDynamicConfig(null);
      }
    },
    (err) => log.error({ err }, "api system config listener error")
  );
}

/**
 * Belt and braces: a listener can stop delivering without ever raising an
 * error, and a monitoring service that silently freezes its fleet in the past
 * is the failure nobody notices. Re-read everything periodically and diff.
 */
export async function reconcileNow(
  onChange: (changed: string[], removed: string[]) => void
): Promise<void> {
  await reconcile(onChange);
}

export function startReconcileLoop(
  onChange: (changed: string[], removed: string[]) => void
): NodeJS.Timeout {
  const timer = setInterval(() => void reconcile(onChange), RECONCILE_MS);
  timer.unref();
  return timer;
}

async function reconcile(
  onChange: (changed: string[], removed: string[]) => void
): Promise<void> {
  {
    try {
      const [monitorSnap, contactSnap, orgSnap, systemConfigSnap] = await Promise.all([
        col.monitors().get(),
        col.alertContacts().get(),
        col.orgs().get(),
        col.system().doc("config").get(),
      ]);

      if (systemConfigSnap.exists) {
        updateDynamicConfig(systemConfigSnap.data() as Record<string, unknown>);
      }

      const seen = new Set<string>();
      const changed: string[] = [];
      getDb().transaction(() => {
        for (const doc of monitorSnap.docs) {
          seen.add(doc.id);
          upsertMonitorConfig(toMonitor(doc.id, doc.data()));
          changed.push(doc.id);
        }
        for (const doc of contactSnap.docs) {
          upsertContact(toContact(doc.id, doc.data()));
        }
        for (const doc of orgSnap.docs) {
          const d = doc.data();
          upsertOrg(doc.id, String(d.name ?? ""), String(d.plan ?? "free"), d.ownerUid);
        }
      })();

      const removed = [...allMonitorIds()].filter((id) => !seen.has(id));
      removed.forEach(deleteMonitor);

      log.debug({ total: seen.size, removed: removed.length }, "reconciled with Firestore");
      onChange(changed, removed);
    } catch (err) {
      log.error({ err }, "reconcile failed");
    }
  }
}

export function stopConfigListener(): void {
  while (subscriptions.length) subscriptions.pop()?.();
}
