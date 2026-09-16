import { Timestamp } from "firebase-admin/firestore";
import { col } from "./firebase.js";
import { listMonitors, markIncidentsSynced, unsyncedIncidents } from "../db/repo.js";
import { ownsOrg } from "../scheduler/assignment.js";
import { log } from "../lib/log.js";
import {
  MIRROR_FLUSH_MS,
  MIRROR_MIN_INTERVAL_MS,
  REGION,
  WORKER_COUNT,
  WORKER_INDEX,
} from "../config.js";

/**
 * Box → Firebase. The aggregated status mirror.
 *
 * This is the design's load-bearing decision. Firestore bills per *document*
 * write regardless of how many fields change, so one document per org —
 * rather than one per monitor — makes the write bill independent of how many
 * monitors exist. An org with 5 monitors and one with 200 cost exactly the
 * same, which is what turns a ~34-monitor free tier into a ~5,000-monitor one.
 *
 * Urgency is split deliberately:
 *   state change  → immediate (debounced), because that is the only latency
 *                   a customer actually notices
 *   routine       → every MIRROR_FLUSH_MS, carrying response times
 */

interface DirtyOrg {
  urgent: boolean;
  lastFlushedAt: number;
}

const dirty = new Map<string, DirtyOrg>();
let timer: NodeJS.Timeout | null = null;

export function markOrgDirty(orgId: string, urgent: boolean): void {
  // Only the worker that owns an org writes its status document. Sharding by
  // org rather than by monitor is what makes that true, and it is why the
  // mirror never needs a merge strategy between workers.
  if (!ownsOrg(orgId, undefined, { region: REGION, index: WORKER_INDEX, count: WORKER_COUNT })) {
    return;
  }
  const entry = dirty.get(orgId);
  if (entry) entry.urgent ||= urgent;
  else dirty.set(orgId, { urgent, lastFlushedAt: 0 });
}

/** Firestore's document ceiling is 1 MiB; a status entry is roughly 200 bytes. */
const MAX_MONITORS_PER_DOC = 2000;

export function buildStatusDoc(monitors: ReturnType<typeof listMonitors>) {
  const entry: Record<string, unknown> = {};
  for (const m of monitors.slice(0, MAX_MONITORS_PER_DOC)) {
    entry[m.id] = {
      status: m.enabled ? m.status : "paused",
      inMaintenance: m.inMaintenance,
      lastCheckedAt: m.lastCheckedAt ?? null,
      lastResponseTimeMs: m.lastResponseTimeMs ?? null,
      lastError: m.lastError ?? null,
      uptime24h: m.uptime24h ?? null,
      uptime30d: m.uptime30d ?? null,
    };
  }
  return entry;
}

async function flushOrg(orgId: string): Promise<void> {
  const monitors = listMonitors(orgId);
  await col.orgStatus().doc(orgId).set(
    {
      orgId,
      flushedAt: Timestamp.now(),
      monitorCount: monitors.length,
      monitors: buildStatusDoc(monitors),
    },
    { merge: true }
  );
}

/**
 * Incidents are mirrored individually because the dashboard lists them and
 * they are rare enough that per-document writes cost nothing.
 */
async function flushIncidents(): Promise<void> {
  const pending = unsyncedIncidents(50);
  if (!pending.length) return;

  const batch = col.incidents().firestore.batch();
  for (const i of pending) {
    batch.set(
      col.incidents().doc(i.id),
      {
        orgId: i.orgId,
        monitorId: i.monitorId,
        monitorName: i.monitorName,
        startedAt: Timestamp.fromMillis(i.startedAt),
        resolvedAt: i.resolvedAt ? Timestamp.fromMillis(i.resolvedAt) : null,
        durationSeconds: i.durationSeconds ?? null,
        cause: i.cause,
        confirmedBy: i.confirmedBy,
        status: i.status,
        suppressed: i.suppressed,
      },
      { merge: true }
    );
  }
  await batch.commit();
  markIncidentsSynced(pending.map((i) => i.id));
  log.debug({ count: pending.length }, "mirrored incidents");
}

async function tick(): Promise<void> {
  const now = Date.now();
  const ready: string[] = [];

  for (const [orgId, state] of dirty) {
    const age = now - state.lastFlushedAt;
    // An urgent change still waits out the debounce, so a flapping monitor
    // cannot spend the daily write budget in a minute.
    const due = state.urgent ? age >= MIRROR_MIN_INTERVAL_MS : age >= MIRROR_FLUSH_MS;
    if (due) ready.push(orgId);
  }

  for (const orgId of ready) {
    try {
      await flushOrg(orgId);
      dirty.set(orgId, { urgent: false, lastFlushedAt: Date.now() });
    } catch (err) {
      log.error({ err, orgId }, "status mirror flush failed");
    }
  }

  try {
    await flushIncidents();
  } catch (err) {
    log.error({ err }, "incident mirror failed");
  }
}

export function startMirror(): void {
  if (timer) return;
  // Runs often; `tick` itself decides which orgs are actually due.
  timer = setInterval(() => void tick(), 5_000);
  timer.unref();
}

export async function stopMirror(): Promise<void> {
  if (timer) clearInterval(timer);
  timer = null;
  // Force a final flush so the dashboard is not left showing stale state.
  for (const [, state] of dirty) state.lastFlushedAt = 0;
  await tick();
}
