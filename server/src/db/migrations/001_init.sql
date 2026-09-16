-- Schema v1.
--
-- The shape that matters: there is no per-check table. One row per monitor per
-- hour holds counters plus a JSON array of samples, which is the difference
-- between 120k inserts a day and 1.44 million at 5,000 monitors.

CREATE TABLE monitors (
  id                   TEXT PRIMARY KEY,
  org_id               TEXT NOT NULL,
  name                 TEXT NOT NULL,
  type                 TEXT NOT NULL,
  target               TEXT NOT NULL DEFAULT '',
  config               TEXT NOT NULL DEFAULT '{}',  -- type-specific fields, JSON
  interval_seconds     INTEGER NOT NULL DEFAULT 300,
  timeout_seconds      INTEGER NOT NULL DEFAULT 10,
  confirmation_threshold INTEGER NOT NULL DEFAULT 2,
  regions              TEXT NOT NULL DEFAULT '[]',  -- JSON array, home region first
  enabled              INTEGER NOT NULL DEFAULT 1,
  maintenance_windows  TEXT NOT NULL DEFAULT '[]',  -- JSON array
  alert_contact_ids    TEXT NOT NULL DEFAULT '[]',  -- JSON array
  heartbeat_token      TEXT,

  -- live state
  status               TEXT NOT NULL DEFAULT 'pending',
  last_checked_at      INTEGER,
  last_status_changed_at INTEGER,
  last_response_time_ms INTEGER,
  last_error           TEXT,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  in_maintenance       INTEGER NOT NULL DEFAULT 0,
  cert_expires_at      INTEGER,
  uptime_24h           REAL,
  uptime_7d            REAL,
  uptime_30d           REAL,

  -- scheduling: local only, never synced
  due_at               INTEGER NOT NULL DEFAULT 0,

  created_at           INTEGER NOT NULL,
  updated_at           INTEGER NOT NULL
);

-- The scheduler's only hot query.
CREATE INDEX idx_monitors_due ON monitors (enabled, due_at);
CREATE INDEX idx_monitors_org ON monitors (org_id);
CREATE UNIQUE INDEX idx_monitors_heartbeat ON monitors (heartbeat_token)
  WHERE heartbeat_token IS NOT NULL;

CREATE TABLE hour_buckets (
  monitor_id  TEXT NOT NULL,
  hour        TEXT NOT NULL,             -- YYYYMMDDHH
  org_id      TEXT NOT NULL,
  up          INTEGER NOT NULL DEFAULT 0,
  down        INTEGER NOT NULL DEFAULT 0,
  sum_ms      INTEGER NOT NULL DEFAULT 0,
  samples     TEXT NOT NULL DEFAULT '[]', -- JSON array
  PRIMARY KEY (monitor_id, hour)
) WITHOUT ROWID;

CREATE INDEX idx_buckets_hour ON hour_buckets (hour);

CREATE TABLE day_rollups (
  monitor_id       TEXT NOT NULL,
  day              TEXT NOT NULL,        -- YYYYMMDD
  org_id           TEXT NOT NULL,
  up               INTEGER NOT NULL DEFAULT 0,
  down             INTEGER NOT NULL DEFAULT 0,
  avg_ms           INTEGER NOT NULL DEFAULT 0,
  uptime_ratio     REAL NOT NULL DEFAULT 1,
  downtime_seconds INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (monitor_id, day)
) WITHOUT ROWID;

CREATE TABLE incidents (
  id               TEXT PRIMARY KEY,
  org_id           TEXT NOT NULL,
  monitor_id       TEXT NOT NULL,
  monitor_name     TEXT NOT NULL,
  started_at       INTEGER NOT NULL,
  resolved_at      INTEGER,
  duration_seconds INTEGER,
  cause            TEXT NOT NULL DEFAULT '',
  confirmed_by     TEXT NOT NULL DEFAULT '[]',
  status           TEXT NOT NULL DEFAULT 'open',
  suppressed       INTEGER NOT NULL DEFAULT 0,
  acknowledged_by  TEXT,
  -- Has this incident been mirrored to Firestore yet?
  synced           INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_incidents_open ON incidents (monitor_id, status, started_at DESC);
CREATE INDEX idx_incidents_unsynced ON incidents (synced) WHERE synced = 0;

-- The transactional outbox. An incident and its alert rows are written in the
-- same transaction, so a crash between "detected" and "notified" is impossible.
CREATE TABLE alert_outbox (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  incident_id     TEXT NOT NULL,
  contact_id      TEXT NOT NULL,
  event           TEXT NOT NULL,          -- down | up
  attempts        INTEGER NOT NULL DEFAULT 0,
  next_attempt_at INTEGER NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending',
  last_error      TEXT,
  created_at      INTEGER NOT NULL
);

CREATE INDEX idx_outbox_due ON alert_outbox (status, next_attempt_at);

-- Local cache of alert contacts, so the drainer never blocks on Firestore.
CREATE TABLE alert_contacts (
  id          TEXT PRIMARY KEY,
  org_id      TEXT NOT NULL,
  channel     TEXT NOT NULL,
  name        TEXT NOT NULL,
  destination TEXT NOT NULL,
  telegram_chat_id TEXT,
  enabled     INTEGER NOT NULL DEFAULT 1,
  verified    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE orgs (
  id      TEXT PRIMARY KEY,
  name    TEXT NOT NULL DEFAULT '',
  plan    TEXT NOT NULL DEFAULT 'free',
  owner_uid TEXT
);
