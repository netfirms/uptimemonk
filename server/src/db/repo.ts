import { randomUUID } from "node:crypto";
import { getDb } from "./index.js";
import { hourKey } from "../lib/time.js";
import type { OrgCredit } from "../lib/credits.js";
import { baseChecksPerDay } from "../lib/plans.js";
import type {
  AlertContact,
  CheckResult,
  DayRollup,
  Incident,
  Monitor,
  MonitorStatus,
  OutboxRow,
  ProbeRegion,
} from "../types.js";

/** SQLite has no boolean type; 0/1 round-trips are all in this one place. */
const bool = (v: unknown) => v === 1 || v === true;
const num = (v: unknown) => (v === 1 || v === true ? 1 : 0);
const json = <T>(raw: unknown, fallback: T): T => {
  if (typeof raw !== "string") return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

export function rowToMonitor(r: any): Monitor {
  const config = json<Record<string, unknown>>(r.config, {});
  return {
    id: r.id,
    orgId: r.org_id,
    name: r.name,
    type: r.type,
    target: r.target,
    intervalSeconds: r.interval_seconds,
    timeoutSeconds: r.timeout_seconds,
    confirmationThreshold: r.confirmation_threshold,
    regions: json(r.regions, [] as ProbeRegion[]),
    enabled: bool(r.enabled),
    maintenanceWindows: json(r.maintenance_windows, []),
    alertContactIds: json(r.alert_contact_ids, [] as string[]),
    heartbeatToken: r.heartbeat_token ?? undefined,
    status: r.status as MonitorStatus,
    lastCheckedAt: r.last_checked_at ?? undefined,
    lastStatusChangedAt: r.last_status_changed_at ?? undefined,
    lastResponseTimeMs: r.last_response_time_ms ?? undefined,
    lastError: r.last_error ?? null,
    consecutiveFailures: r.consecutive_failures,
    inMaintenance: bool(r.in_maintenance),
    certExpiresAt: r.cert_expires_at ?? null,
    uptime24h: r.uptime_24h ?? undefined,
    uptime7d: r.uptime_7d ?? undefined,
    uptime30d: r.uptime_30d ?? undefined,
    dueAt: r.due_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    ...config, // type-specific fields: keyword, port, dnsRecordType, …
  } as Monitor;
}

/** Fields that live in the `config` JSON blob rather than their own column. */
const CONFIG_KEYS = [
  "port",
  "method",
  "requestHeaders",
  "requestBody",
  "acceptedStatusCodes",
  "followRedirects",
  "maxResponseTimeMs",
  "httpAuthType",
  "keyword",
  "keywordInverted",
  "keywordCaseSensitive",
  "keywordRegex",
  "jsonPath",
  "jsonPathExpected",
  "dnsRecordType",
  "dnsExpectedValue",
  "dnsServer",
  "sslExpiryWarningDays",
  "sslExpectedFingerprint",
  "sslMinVersion",
  "tcpPayload",
  "tcpExpectedResponse",
  "icmpPacketCount",
  "icmpMaxLossPercent",
  "heartbeatGraceSeconds",
  "publicOnStatusPage",
  "muteAlerts",
] as const;

function configBlob(m: Partial<Monitor>): string {
  const out: Record<string, unknown> = {};
  for (const key of CONFIG_KEYS) {
    if (m[key] !== undefined) out[key] = m[key];
  }
  return JSON.stringify(out);
}

// ---------------------------------------------------------------- monitors

/**
 * Insert or update a monitor from its Firestore config, without ever
 * clobbering local state.
 *
 * The excluded columns are the point: `status`, `due_at`, failure counts and
 * uptime are owned by the worker. A config sync that reset them would restart
 * every monitor's state machine each time the listener reconnected.
 */
export function upsertMonitorConfig(m: Monitor): void {
  getDb()
    .prepare(
      `INSERT INTO monitors (
        id, org_id, name, type, target, config, interval_seconds, timeout_seconds,
        confirmation_threshold, regions, enabled, maintenance_windows,
        alert_contact_ids, heartbeat_token, status, due_at, created_at, updated_at
      ) VALUES (
        @id, @orgId, @name, @type, @target, @config, @intervalSeconds, @timeoutSeconds,
        @confirmationThreshold, @regions, @enabled, @maintenanceWindows,
        @alertContactIds, @heartbeatToken, 'pending', @dueAt, @createdAt, @updatedAt
      )
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        type = excluded.type,
        target = excluded.target,
        config = excluded.config,
        interval_seconds = excluded.interval_seconds,
        timeout_seconds = excluded.timeout_seconds,
        confirmation_threshold = excluded.confirmation_threshold,
        regions = excluded.regions,
        enabled = excluded.enabled,
        maintenance_windows = excluded.maintenance_windows,
        alert_contact_ids = excluded.alert_contact_ids,
        heartbeat_token = excluded.heartbeat_token,
        updated_at = excluded.updated_at`
    )
    .run({
      id: m.id,
      orgId: m.orgId,
      name: m.name,
      type: m.type,
      target: m.target ?? "",
      config: configBlob(m),
      intervalSeconds: m.intervalSeconds,
      timeoutSeconds: m.timeoutSeconds,
      confirmationThreshold: m.confirmationThreshold,
      regions: JSON.stringify(m.regions ?? []),
      enabled: num(m.enabled),
      maintenanceWindows: JSON.stringify(m.maintenanceWindows ?? []),
      alertContactIds: JSON.stringify(m.alertContactIds ?? []),
      heartbeatToken: m.heartbeatToken ?? null,
      dueAt: m.dueAt ?? Date.now(),
      createdAt: m.createdAt ?? Date.now(),
      updatedAt: m.updatedAt ?? Date.now(),
    });
}

/**
 * Delete a monitor and everything that belongs to it.
 *
 * Without the cascade the monitor row vanished while its buckets, day rollups
 * and incidents stayed behind forever. `day_rollups` and `incidents` are never
 * pruned by design — they are the permanent record — so dead rows accumulated
 * with nothing to ever remove them, and the orphaned incidents still showed up
 * in the dashboard's list for the org.
 *
 * One transaction: a half-deleted monitor is worse than either outcome.
 */
export function deleteMonitor(id: string): void {
  const db = getDb();
  db.transaction(() => {
    // Outbox rows reference incidents, so they go first.
    db.prepare(
      `DELETE FROM alert_outbox WHERE incident_id IN
         (SELECT id FROM incidents WHERE monitor_id = ?)`
    ).run(id);
    db.prepare("DELETE FROM incidents WHERE monitor_id = ?").run(id);
    db.prepare("DELETE FROM hour_buckets WHERE monitor_id = ?").run(id);
    db.prepare("DELETE FROM day_rollups WHERE monitor_id = ?").run(id);
    db.prepare("DELETE FROM monitors WHERE id = ?").run(id);
  })();
}

/**
 * One-off repair for monitors deleted before the cascade existed. Runs at
 * worker start: cheap when there is nothing to do, and it is the only way the
 * rows already stranded on disk ever go away.
 */
export function purgeOrphanedHistory(): number {
  const db = getDb();
  let removed = 0;
  db.transaction(() => {
    for (const table of ["hour_buckets", "day_rollups", "incidents"]) {
      const info = db
        .prepare(
          `DELETE FROM ${table} WHERE monitor_id NOT IN (SELECT id FROM monitors)`
        )
        .run();
      removed += info.changes;
    }
    removed += db
      .prepare(
        `DELETE FROM alert_outbox WHERE incident_id NOT IN (SELECT id FROM incidents)`
      )
      .run().changes;
  })();
  return removed;
}

export function getMonitor(id: string): Monitor | null {
  const row = getDb().prepare("SELECT * FROM monitors WHERE id = ?").get(id);
  return row ? rowToMonitor(row) : null;
}

export function getMonitorByHeartbeatToken(token: string): Monitor | null {
  const row = getDb()
    .prepare("SELECT * FROM monitors WHERE heartbeat_token = ?")
    .get(token);
  return row ? rowToMonitor(row) : null;
}

export function listMonitors(orgId?: string): Monitor[] {
  const rows = orgId
    ? getDb().prepare("SELECT * FROM monitors WHERE org_id = ? ORDER BY name").all(orgId)
    : getDb().prepare("SELECT * FROM monitors ORDER BY name").all();
  return rows.map(rowToMonitor);
}

export function allMonitorIds(): Set<string> {
  return new Set(
    getDb().prepare("SELECT id FROM monitors").all().map((r: any) => r.id)
  );
}

export function setDueAt(id: string, dueAt: number): void {
  getDb().prepare("UPDATE monitors SET due_at = ? WHERE id = ?").run(dueAt, id);
}

// ------------------------------------------------------------ check results

export interface PendingWrite {
  monitor: Monitor;
  result: CheckResult;
  status: MonitorStatus;
  failures: number;
  suppressed: boolean;
  statusChanged: boolean;
}

/**
 * Flush a batch of check results in a single transaction.
 *
 * better-sqlite3 is synchronous, so every statement blocks the event loop.
 * Batching is what keeps that acceptable: a thousand rows inside one
 * transaction costs about a millisecond, where a thousand separate writes
 * would hand the loop a syscall per probe.
 */
export function flushResults(writes: PendingWrite[]): void {
  if (!writes.length) return;
  const db = getDb();

  const updateMonitor = db.prepare(
    `UPDATE monitors SET
       status = @status,
       last_checked_at = @checkedAt,
       last_response_time_ms = @responseTimeMs,
       last_error = @error,
       consecutive_failures = @failures,
       in_maintenance = @inMaintenance,
       cert_expires_at = COALESCE(@certExpiresAt, cert_expires_at),
       last_status_changed_at = CASE WHEN @statusChanged = 1
         THEN @checkedAt ELSE last_status_changed_at END,
       updated_at = @checkedAt
     WHERE id = @id`
  );

  // One row per monitor-hour. arrayUnion has no SQLite equivalent, so append
  // to the JSON array with json_insert at the end position.
  const upsertBucket = db.prepare(
    `INSERT INTO hour_buckets (monitor_id, hour, org_id, up, down, sum_ms, samples)
     VALUES (@monitorId, @hour, @orgId, @up, @down, @sumMs, json_array(json(@sample)))
     ON CONFLICT(monitor_id, hour) DO UPDATE SET
       up = up + excluded.up,
       down = down + excluded.down,
       sum_ms = sum_ms + excluded.sum_ms,
       samples = json_insert(samples, '$[#]', json(@sample))`
  );

  db.transaction((batch: PendingWrite[]) => {
    for (const w of batch) {
      const certExpiresAt =
        typeof w.result.meta?.expiresAt === "number"
          ? (w.result.meta.expiresAt as number)
          : null;

      updateMonitor.run({
        id: w.monitor.id,
        status: w.status,
        checkedAt: w.result.checkedAt,
        responseTimeMs: w.result.responseTimeMs,
        error: w.result.error ?? null,
        failures: w.failures,
        inMaintenance: num(w.suppressed),
        certExpiresAt,
        statusChanged: num(w.statusChanged),
      });

      upsertBucket.run({
        monitorId: w.monitor.id,
        hour: hourKey(w.result.checkedAt),
        orgId: w.monitor.orgId,
        up: w.result.ok ? 1 : 0,
        down: w.result.ok ? 0 : 1,
        sumMs: w.result.responseTimeMs,
        sample: JSON.stringify({
          t: w.result.checkedAt,
          ms: w.result.responseTimeMs,
          ok: w.result.ok,
          ...(w.result.statusCode ? { code: w.result.statusCode } : {}),
        }),
      });
    }
  })(writes);
}

// --------------------------------------------------------------- incidents

/**
 * Open an incident and queue its alerts in ONE transaction.
 *
 * This is the whole reason for the outbox: a crash between "we noticed the
 * outage" and "we told the customer" is the one gap this product cannot have.
 * Either both rows exist or neither does.
 */
export function openIncident(
  monitor: Monitor,
  cause: string,
  region: ProbeRegion,
  startedAt: number,
  suppressed: boolean
): string {
  const db = getDb();
  const id = randomUUID();

  db.transaction(() => {
    db.prepare(
      `INSERT INTO incidents (id, org_id, monitor_id, monitor_name, started_at,
                              cause, confirmed_by, status, suppressed, synced)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?, 0)`
    ).run(
      id,
      monitor.orgId,
      monitor.id,
      monitor.name,
      startedAt,
      cause,
      JSON.stringify([region]),
      num(suppressed)
    );

    // Maintenance suppresses paging, not the record.
    if (!suppressed) queueAlerts(id, monitor, "down", startedAt);
  })();

  return id;
}

export function resolveOpenIncident(
  monitor: Monitor,
  resolvedAt: number,
  suppressed: boolean
): string | null {
  const db = getDb();
  const open: any = db
    .prepare(
      `SELECT * FROM incidents WHERE monitor_id = ? AND status = 'open'
       ORDER BY started_at DESC LIMIT 1`
    )
    .get(monitor.id);
  if (!open) return null;

  db.transaction(() => {
    db.prepare(
      `UPDATE incidents SET status = 'resolved', resolved_at = ?,
         duration_seconds = ?, synced = 0 WHERE id = ?`
    ).run(resolvedAt, Math.round((resolvedAt - open.started_at) / 1000), open.id);

    if (!suppressed) queueAlerts(open.id, monitor, "up", resolvedAt);
  })();

  return open.id;
}

/**
 * Fan an incident out to the contacts that should hear about it.
 *
 * An empty `alertContactIds` means **everyone verified in the org**, not
 * nobody. That distinction is the whole feature: every monitor was created
 * with an empty list, so the previous reading — iterate the list, send to
 * whoever is in it — meant two real incidents passed with zero alerts queued
 * while a verified contact sat unused. Silence is the one failure mode a
 * monitoring product cannot have, so it is not the default.
 *
 * Deliberate silence is `muteAlerts`, which is explicit and visible in the UI.
 * A non-empty list is honoured exactly as given.
 *
 * Must be called inside an open transaction — see openIncident.
 */
function queueAlerts(
  incidentId: string,
  monitor: Monitor,
  event: "down" | "up",
  now: number
): void {
  if (monitor.muteAlerts) return;

  const explicit = monitor.alertContactIds ?? [];
  const contactIds = explicit.length ? explicit : deliverableContactIds(monitor.orgId);

  const insert = getDb().prepare(
    `INSERT INTO alert_outbox (incident_id, contact_id, event, next_attempt_at, created_at)
     VALUES (?, ?, ?, ?, ?)`
  );
  for (const contactId of contactIds) {
    insert.run(incidentId, contactId, event, now, now);
  }
}

export function getIncident(id: string): Incident | null {
  const r: any = getDb().prepare("SELECT * FROM incidents WHERE id = ?").get(id);
  if (!r) return null;
  return {
    id: r.id,
    orgId: r.org_id,
    monitorId: r.monitor_id,
    monitorName: r.monitor_name,
    startedAt: r.started_at,
    resolvedAt: r.resolved_at,
    durationSeconds: r.duration_seconds,
    cause: r.cause,
    confirmedBy: json(r.confirmed_by, []),
    status: r.status,
    suppressed: bool(r.suppressed),
    acknowledgedBy: r.acknowledged_by,
  };
}

export function unsyncedIncidents(limit = 50): Incident[] {
  const rows = getDb()
    .prepare("SELECT id FROM incidents WHERE synced = 0 LIMIT ?")
    .all(limit) as any[];
  return rows.map((r) => getIncident(r.id)!).filter(Boolean);
}

export function markIncidentsSynced(ids: string[]): void {
  if (!ids.length) return;
  const stmt = getDb().prepare("UPDATE incidents SET synced = 1 WHERE id = ?");
  getDb().transaction(() => ids.forEach((id) => stmt.run(id)))();
}

// ------------------------------------------------------------------ outbox

export function dueOutbox(now: number, limit = 50): OutboxRow[] {
  const rows = getDb()
    .prepare(
      `SELECT * FROM alert_outbox WHERE status = 'pending' AND next_attempt_at <= ?
       ORDER BY next_attempt_at LIMIT ?`
    )
    .all(now, limit) as any[];
  return rows.map((r) => ({
    id: r.id,
    incidentId: r.incident_id,
    contactId: r.contact_id,
    event: r.event,
    attempts: r.attempts,
    nextAttemptAt: r.next_attempt_at,
    status: r.status,
    lastError: r.last_error,
  }));
}

export function markOutboxSent(id: number): void {
  getDb()
    .prepare("UPDATE alert_outbox SET status = 'sent', attempts = attempts + 1 WHERE id = ?")
    .run(id);
}

/** Exponential backoff, giving up after `maxAttempts` so a dead webhook
 *  cannot occupy the drainer forever. */
export function markOutboxFailed(
  id: number,
  attempts: number,
  error: string,
  maxAttempts = 6
): void {
  const giveUp = attempts + 1 >= maxAttempts;
  const backoffMs = Math.min(30 * 60_000, 10_000 * 2 ** attempts);
  getDb()
    .prepare(
      `UPDATE alert_outbox SET attempts = attempts + 1, last_error = ?,
         status = ?, next_attempt_at = ? WHERE id = ?`
    )
    .run(error.slice(0, 500), giveUp ? "failed" : "pending", Date.now() + backoffMs, id);
}

// ---------------------------------------------------------------- contacts

export function upsertContact(c: AlertContact): void {
  getDb()
    .prepare(
      `INSERT INTO alert_contacts (id, org_id, channel, name, destination,
                                   telegram_chat_id, enabled, verified)
       VALUES (@id, @orgId, @channel, @name, @destination, @telegramChatId, @enabled, @verified)
       ON CONFLICT(id) DO UPDATE SET
         channel = excluded.channel, name = excluded.name,
         destination = excluded.destination,
         telegram_chat_id = excluded.telegram_chat_id,
         enabled = excluded.enabled, verified = excluded.verified`
    )
    .run({
      id: c.id,
      orgId: c.orgId,
      channel: c.channel,
      name: c.name,
      destination: c.destination,
      telegramChatId: c.telegramChatId ?? null,
      enabled: num(c.enabled),
      verified: num(c.verified),
    });
}

function rowToContact(r: any): AlertContact {
  return {
    id: r.id,
    orgId: r.org_id,
    channel: r.channel,
    name: r.name,
    destination: r.destination,
    telegramChatId: r.telegram_chat_id ?? undefined,
    enabled: bool(r.enabled),
    verified: bool(r.verified),
  };
}

export function getContact(id: string): AlertContact | null {
  const r: any = getDb().prepare("SELECT * FROM alert_contacts WHERE id = ?").get(id);
  return r ? rowToContact(r) : null;
}

export function deleteContact(id: string): void {
  getDb().prepare("DELETE FROM alert_contacts WHERE id = ?").run(id);
}

export function listContacts(orgId: string): AlertContact[] {
  const rows = getDb()
    .prepare("SELECT * FROM alert_contacts WHERE org_id = ? ORDER BY name")
    .all(orgId) as any[];
  return rows.map(rowToContact);
}

/** Everyone in the org who could actually receive an alert right now. */
export function deliverableContactIds(orgId: string): string[] {
  return (
    getDb()
      .prepare(
        `SELECT id FROM alert_contacts
         WHERE org_id = ? AND enabled = 1 AND verified = 1`
      )
      .all(orgId) as any[]
  ).map((r) => r.id);
}

// ------------------------------------------------------------------- orgs

export function upsertOrg(id: string, name: string, plan: string, ownerUid?: string): void {
  getDb()
    .prepare(
      `INSERT INTO orgs (id, name, plan, owner_uid) VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, plan = excluded.plan`
    )
    .run(id, name, plan, ownerUid ?? null);
}

export function getOrgCredit(id: string): OrgCredit {
  const r: any = getDb()
    .prepare(
      `SELECT credits, donation_usd_monthly, grace_until, plan FROM orgs WHERE id = ?`
    )
    .get(id);
  return {
    credits: r?.credits ?? 0,
    donationUsdMonthly: r?.donation_usd_monthly ?? 0,
    graceUntil: r?.grace_until ?? null,
    // A legacy paid plan raises the free allowance rather than gating
    // anything, so grandfathered orgs keep the capacity they paid for.
    baseChecksPerDay: baseChecksPerDay(r?.plan),
  };
}

/**
 * Post a credit movement, once.
 *
 * The whole operation is one transaction, and the ledger's
 * `UNIQUE (reason, ref)` is what makes it idempotent: a replayed Stripe
 * delivery or a restarted rollup inserts nothing and changes no balance. That
 * is a database guarantee rather than a check the caller has to remember, and
 * it holds under concurrency, which a read-then-write never did.
 *
 * Returns the applied movement, or null when this `(reason, ref)` had already
 * been posted.
 */
export function postCredit(entry: {
  orgId: string;
  delta: number;
  reason: "grant" | "burn" | "refund" | "dispute" | "adjust";
  ref: string;
  note?: string;
  now?: number;
}): { balance: number; delta: number } | null {
  const db = getDb();
  const now = entry.now ?? Date.now();

  return db.transaction(() => {
    const claimed = db
      .prepare(
        `INSERT OR IGNORE INTO credit_ledger
           (org_id, at, delta, reason, ref, balance_after, note)
         VALUES (?, ?, ?, ?, ?, 0, ?)`
      )
      .run(entry.orgId, now, entry.delta, entry.reason, entry.ref, entry.note ?? null);

    // Already posted. Not an error — Stripe retries by design.
    if (claimed.changes === 0) return null;

    // Clamped at zero: a balance may be exhausted but never owed. An overdraft
    // would quietly become a debt the customer never agreed to.
    db.prepare(
      `UPDATE orgs SET credits = MAX(0, credits + ?) WHERE id = ?`
    ).run(entry.delta, entry.orgId);

    const balance: number =
      (db.prepare("SELECT credits FROM orgs WHERE id = ?").get(entry.orgId) as any)
        ?.credits ?? 0;

    db.prepare("UPDATE credit_ledger SET balance_after = ? WHERE id = ?").run(
      balance,
      claimed.lastInsertRowid
    );

    return { balance, delta: entry.delta };
  })();
}

/** The movements behind a balance, newest first — the audit trail. */
export function creditLedger(orgId: string, limit = 50) {
  return getDb()
    .prepare(
      `SELECT at, delta, reason, ref, balance_after, note FROM credit_ledger
       WHERE org_id = ? ORDER BY at DESC, id DESC LIMIT ?`
    )
    .all(orgId, limit) as {
    at: number;
    delta: number;
    reason: string;
    ref: string;
    balance_after: number;
    note: string | null;
  }[];
}

/** Grace and the recurring amount are state, not movements, so they stay
 *  here rather than in the ledger. */
export function setDonationState(
  id: string,
  s: { donationUsdMonthly?: number; graceUntil?: number | null }
): void {
  if (s.donationUsdMonthly !== undefined) {
    getDb()
      .prepare("UPDATE orgs SET donation_usd_monthly = ? WHERE id = ?")
      .run(s.donationUsdMonthly, id);
  }
  if (s.graceUntil !== undefined) {
    getDb().prepare("UPDATE orgs SET grace_until = ? WHERE id = ?").run(s.graceUntil, id);
  }
}

export function setOrgCredit(id: string, c: OrgCredit): void {
  getDb()
    .prepare(
      `UPDATE orgs SET credits = ?, donation_usd_monthly = ?, grace_until = ?
       WHERE id = ?`
    )
    .run(c.credits, c.donationUsdMonthly, c.graceUntil, id);
}

/**
 * Orgs that actually ran checks on `day`.
 *
 * No "needs burning" marker any more: the ledger's unique (reason, ref)
 * decides whether a day has been charged, so this only has to find candidates
 * and can be re-run freely.
 */
export function orgsWithUsageOn(day: string): string[] {
  return (
    getDb()
      .prepare("SELECT DISTINCT org_id FROM day_rollups WHERE day = ?")
      .all(day) as any[]
  ).map((r) => r.org_id);
}

/** Checks actually performed by an org on a day, from the rollups. */
export function checksOnDay(orgId: string, day: string): number {
  const r: any = getDb()
    .prepare(
      `SELECT COALESCE(SUM(up + down), 0) n FROM day_rollups
       WHERE org_id = ? AND day = ?`
    )
    .get(orgId, day);
  return r?.n ?? 0;
}

export function getOrgPlan(id: string): string {
  const r: any = getDb().prepare("SELECT plan FROM orgs WHERE id = ?").get(id);
  return r?.plan ?? "free";
}

// ------------------------------------------------------------- aggregation

export function bucketsForDay(day: string): Map<string, { orgId: string; up: number; down: number; sumMs: number }> {
  const rows = getDb()
    .prepare(
      `SELECT monitor_id, org_id, SUM(up) up, SUM(down) down, SUM(sum_ms) sum_ms
       FROM hour_buckets WHERE hour >= ? AND hour <= ? GROUP BY monitor_id`
    )
    .all(`${day}00`, `${day}23`) as any[];

  const out = new Map<string, { orgId: string; up: number; down: number; sumMs: number }>();
  for (const r of rows) {
    out.set(r.monitor_id, { orgId: r.org_id, up: r.up, down: r.down, sumMs: r.sum_ms });
  }
  return out;
}

export function writeDayRollup(r: DayRollup): void {
  getDb()
    .prepare(
      `INSERT INTO day_rollups (monitor_id, day, org_id, up, down, avg_ms,
                                uptime_ratio, downtime_seconds)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(monitor_id, day) DO UPDATE SET
         up = excluded.up, down = excluded.down, avg_ms = excluded.avg_ms,
         uptime_ratio = excluded.uptime_ratio,
         downtime_seconds = excluded.downtime_seconds`
    )
    .run(r.monitorId, r.day, r.orgId, r.up, r.down, r.avgMs, r.uptimeRatio, r.downtimeSeconds);
}

export function trailingUptime(monitorId: string, days: string[]): number {
  if (!days.length) return 100;
  const placeholders = days.map(() => "?").join(",");
  const r: any = getDb()
    .prepare(
      `SELECT SUM(up) up, SUM(up + down) total FROM day_rollups
       WHERE monitor_id = ? AND day IN (${placeholders})`
    )
    .get(monitorId, ...days);
  if (!r?.total) return 100;
  return Number(((r.up / r.total) * 100).toFixed(4));
}

export function setUptimes(
  monitorId: string,
  u24: number,
  u7: number,
  u30: number
): void {
  getDb()
    .prepare("UPDATE monitors SET uptime_24h = ?, uptime_7d = ?, uptime_30d = ? WHERE id = ?")
    .run(u24, u7, u30, monitorId);
}

/**
 * Retention for resolved incidents.
 *
 * Incidents had no policy at all: a flapping monitor writes one per transition,
 * and nothing ever removed them. Open incidents are never touched — an
 * unresolved outage is current state, not history, however old it looks.
 */
export function pruneIncidents(beforeMs: number): number {
  const db = getDb();
  let removed = 0;
  db.transaction(() => {
    removed += db
      .prepare(
        `DELETE FROM alert_outbox WHERE incident_id IN
           (SELECT id FROM incidents
             WHERE status = 'resolved' AND resolved_at IS NOT NULL AND resolved_at < ?)`
      )
      .run(beforeMs).changes;
    removed += db
      .prepare(
        `DELETE FROM incidents
          WHERE status = 'resolved' AND resolved_at IS NOT NULL AND resolved_at < ?`
      )
      .run(beforeMs).changes;
  })();
  return removed;
}

/** Nightly retention. Day rollups are tiny and kept indefinitely. */
export function pruneBuckets(beforeHour: string): number {
  const info = getDb().prepare("DELETE FROM hour_buckets WHERE hour < ?").run(beforeHour);
  return info.changes;
}

// ------------------------------------------------------------------ history

export interface HistorySample {
  t: number;
  ms: number;
  ok: boolean;
  code?: number;
}

/** Day rollups, newest first. Powers the uptime bar on the detail view. */
export function dayRollupsFor(monitorId: string, limit = 90): DayRollup[] {
  const rows = getDb()
    .prepare(
      `SELECT * FROM day_rollups WHERE monitor_id = ?
       ORDER BY day DESC LIMIT ?`
    )
    .all(monitorId, limit) as any[];
  return rows.map((r) => ({
    monitorId: r.monitor_id,
    orgId: r.org_id,
    day: r.day,
    up: r.up,
    down: r.down,
    avgMs: r.avg_ms,
    uptimeRatio: r.uptime_ratio,
    downtimeSeconds: r.downtime_seconds,
  }));
}

/**
 * Raw samples from the most recent hour buckets, oldest first.
 *
 * Downsampled to `maxPoints` before returning: at a 60-second interval a day
 * is 1,440 points, which is more than a chart can show and more than is worth
 * sending. Takes every Nth point rather than averaging, so a spike stays a
 * spike instead of being smoothed into the noise.
 */
export function recentSamples(
  monitorId: string,
  hours = 24,
  maxPoints = 300
): HistorySample[] {
  const rows = getDb()
    .prepare(
      `SELECT samples FROM hour_buckets WHERE monitor_id = ?
       ORDER BY hour DESC LIMIT ?`
    )
    .all(monitorId, hours) as any[];

  const all: HistorySample[] = [];
  for (const r of rows.reverse()) {
    try {
      const parsed = JSON.parse(r.samples ?? "[]") as HistorySample[];
      if (Array.isArray(parsed)) all.push(...parsed);
    } catch {
      // A malformed bucket should cost one hour of chart, not the whole view.
    }
  }
  all.sort((a, b) => a.t - b.t);

  if (all.length <= maxPoints) return all;
  const step = Math.ceil(all.length / maxPoints);
  const out = all.filter((_, i) => i % step === 0);
  // Always keep the most recent point: it is the one the header shows.
  if (out[out.length - 1] !== all[all.length - 1]) out.push(all[all.length - 1]);
  return out;
}

/** Incidents for one monitor, newest first. */
export function incidentsFor(monitorId: string, limit = 25): Incident[] {
  const rows = getDb()
    .prepare(
      `SELECT id FROM incidents WHERE monitor_id = ?
       ORDER BY started_at DESC LIMIT ?`
    )
    .all(monitorId, limit) as any[];
  return rows.map((r) => getIncident(r.id)!).filter(Boolean);
}

/** Totals across the hour buckets still on disk, for the detail header. */
/**
 * Totals for a window.
 *
 * `sinceHour` scopes it to the same span the chart is showing — an all-time
 * check count sitting beside a "last 24 hours" chart answers a question nobody
 * asked. Omitted, it stays all-time.
 */
export function historySummary(
  monitorId: string,
  sinceHour?: string
): {
  checks: number;
  up: number;
  down: number;
  avgMs: number;
} {
  const r: any = sinceHour
    ? getDb()
        .prepare(
          `SELECT SUM(up) up, SUM(down) down, SUM(sum_ms) sum_ms
           FROM hour_buckets WHERE monitor_id = ? AND hour >= ?`
        )
        .get(monitorId, sinceHour)
    : getDb()
        .prepare(
          `SELECT SUM(up) up, SUM(down) down, SUM(sum_ms) sum_ms
           FROM hour_buckets WHERE monitor_id = ?`
        )
        .get(monitorId);
  const up = r?.up ?? 0;
  const down = r?.down ?? 0;
  const checks = up + down;
  return { checks, up, down, avgMs: checks ? Math.round((r.sum_ms ?? 0) / checks) : 0 };
}

/**
 * Hourly buckets, oldest first — the short-range counterpart to
 * `dayRollupsFor`. Deliberately does not parse the `samples` blob: callers
 * that want individual points use `recentSamples`, and a bar only needs the
 * counts.
 */
export function hourBucketsFor(
  monitorId: string,
  hours = 24
): { hour: string; up: number; down: number; avgMs: number; uptimeRatio: number }[] {
  const rows = getDb()
    .prepare(
      `SELECT hour, up, down, sum_ms FROM hour_buckets
       WHERE monitor_id = ? ORDER BY hour DESC LIMIT ?`
    )
    .all(monitorId, hours) as any[];

  return rows.reverse().map((r) => {
    const checks = r.up + r.down;
    return {
      hour: r.hour,
      up: r.up,
      down: r.down,
      avgMs: checks ? Math.round(r.sum_ms / checks) : 0,
      uptimeRatio: checks ? r.up / checks : 0,
    };
  });
}

/**
 * Restore live state onto a monitor this worker has no history for.
 *
 * Used when an organisation moves between workers. The new owner's SQLite
 * knows nothing about the monitor, so without this its state machine restarts
 * at `pending`: a monitor that was down goes quiet and then re-alerts as a
 * fresh outage, and one that was up briefly reports as unknown.
 *
 * Only ever applied to a monitor with no local check history — never
 * overwrites state this worker actually observed.
 */
export function seedStateIfUnknown(
  id: string,
  state: {
    status: MonitorStatus;
    lastCheckedAt?: number | null;
    lastResponseTimeMs?: number | null;
    lastError?: string | null;
    inMaintenance?: boolean;
    uptime24h?: number | null;
    uptime30d?: number | null;
  }
): boolean {
  const info = getDb()
    .prepare(
      `UPDATE monitors SET
         status = @status,
         last_checked_at = @lastCheckedAt,
         last_response_time_ms = @lastResponseTimeMs,
         last_error = @lastError,
         in_maintenance = @inMaintenance,
         uptime_24h = COALESCE(@uptime24h, uptime_24h),
         uptime_30d = COALESCE(@uptime30d, uptime_30d)
       WHERE id = @id AND last_checked_at IS NULL`
    )
    .run({
      id,
      status: state.status,
      lastCheckedAt: state.lastCheckedAt ?? null,
      lastResponseTimeMs: state.lastResponseTimeMs ?? null,
      lastError: state.lastError ?? null,
      inMaintenance: state.inMaintenance ? 1 : 0,
      uptime24h: state.uptime24h ?? null,
      uptime30d: state.uptime30d ?? null,
    });
  return info.changes > 0;
}

/** Re-create an open incident that belongs to a monitor this worker adopted,
 *  so its eventual recovery resolves it and sends the "up" notice. */
export function adoptOpenIncident(i: {
  id: string;
  orgId: string;
  monitorId: string;
  monitorName: string;
  startedAt: number;
  cause: string;
  suppressed?: boolean;
}): void {
  getDb()
    .prepare(
      `INSERT INTO incidents (id, org_id, monitor_id, monitor_name, started_at,
                              cause, confirmed_by, status, suppressed, synced)
       VALUES (?, ?, ?, ?, ?, ?, '[]', 'open', ?, 1)
       ON CONFLICT(id) DO NOTHING`
    )
    .run(i.id, i.orgId, i.monitorId, i.monitorName, i.startedAt, i.cause,
         i.suppressed ? 1 : 0);
}

export function hasLocalHistory(monitorId: string): boolean {
  const r: any = getDb()
    .prepare("SELECT last_checked_at FROM monitors WHERE id = ?")
    .get(monitorId);
  return !!r?.last_checked_at;
}
