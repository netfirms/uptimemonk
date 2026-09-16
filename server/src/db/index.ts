import Database from "better-sqlite3";
import { readFileSync, readdirSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DB_PATH, SQLITE_CACHE_KB, SQLITE_MMAP_BYTES } from "../config.js";
import { log } from "../lib/log.js";

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), "migrations");

let db: Database.Database | null = null;

/**
 * Open the database, applying the pragmas that make SQLite behave like a
 * server database rather than a desktop file.
 *
 * `busy_timeout` is the one that makes the two-process split (api + worker)
 * safe: WAL allows a single writer at a time, and without a timeout the API's
 * occasional config write would throw SQLITE_BUSY instead of waiting out the
 * worker's five-second flush.
 */
export function openDb(path = DB_PATH): Database.Database {
  if (db) return db;

  mkdirSync(dirname(path), { recursive: true });
  const conn = new Database(path);

  conn.pragma("journal_mode = WAL");
  conn.pragma("synchronous = NORMAL"); // durable under WAL, far faster than FULL
  conn.pragma("busy_timeout = 5000");
  conn.pragma("foreign_keys = ON");
  conn.pragma("temp_store = MEMORY");
  // Negative cache_size means KiB rather than pages. Both are tuned down on
  // small instances — on a 512 MB box the page cache competes directly with
  // the probe pool's sockets.
  conn.pragma(`cache_size = -${SQLITE_CACHE_KB}`);
  conn.pragma(`mmap_size = ${SQLITE_MMAP_BYTES}`);

  db = conn;
  migrate(conn);
  return conn;
}

export function getDb(): Database.Database {
  if (!db) return openDb();
  return db;
}

export function closeDb(): void {
  db?.close();
  db = null;
}

/**
 * Numbered migrations applied in order, tracked in a table. Deliberately not a
 * migration framework: twelve tables do not need one, and a plain SQL file is
 * the artefact you actually want to read during an incident.
 */
function migrate(conn: Database.Database): void {
  conn.exec(`CREATE TABLE IF NOT EXISTS schema_meta (
    version INTEGER PRIMARY KEY,
    applied_at INTEGER NOT NULL
  )`);

  const applied = new Set(
    conn.prepare("SELECT version FROM schema_meta").all().map((r: any) => r.version)
  );

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const version = Number(file.split("_")[0]);
    if (!Number.isFinite(version)) {
      throw new Error(`Migration ${file} must start with a number`);
    }
    if (applied.has(version)) continue;

    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    // One transaction per migration: a failure leaves the schema untouched
    // rather than half-applied, which is the state nobody knows how to fix.
    conn.transaction(() => {
      conn.exec(sql);
      conn
        .prepare("INSERT INTO schema_meta (version, applied_at) VALUES (?, ?)")
        .run(version, Date.now());
    })();
    log.info({ migration: file }, "applied migration");
  }
}
