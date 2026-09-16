import type { MaintenanceWindow } from "../types.js";

const pad = (n: number, len = 2) => String(n).padStart(len, "0");

/** "YYYYMMDDHH" in UTC — the hour-bucket document id. */
export function hourKey(ms: number): string {
  const d = new Date(ms);
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}` +
    `${pad(d.getUTCDate())}${pad(d.getUTCHours())}`
  );
}

/** "YYYYMMDD" in UTC — the daily-rollup document id. */
export function dayKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
}

export function dayKeysBack(fromMs: number, days: number): string[] {
  const keys: string[] = [];
  for (let i = 0; i < days; i++) {
    keys.push(dayKey(fromMs - i * 86_400_000));
  }
  return keys;
}

/**
 * Local wall-clock parts for an IANA timezone, without pulling in a date lib.
 * Intl is built into Node, so this costs nothing at deploy time.
 */
function zonedParts(ms: number, timeZone: string) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  const parts = fmt.formatToParts(new Date(ms));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const weekdayMap: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7,
  };
  return {
    weekday: weekdayMap[get("weekday")] ?? 1,
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** True when `ms` falls inside any configured maintenance window. */
export function inMaintenance(
  windows: MaintenanceWindow[] | undefined,
  ms: number
): boolean {
  if (!windows?.length) return false;
  return windows.some((w) => {
    const { weekday, minutes } = zonedParts(ms, w.timezone || "UTC");
    if (w.weekdays?.length && !w.weekdays.includes(weekday)) return false;
    const start = hhmmToMinutes(w.start);
    const end = hhmmToMinutes(w.end);
    // Window that wraps past midnight, e.g. 23:00 -> 02:00.
    return start <= end
      ? minutes >= start && minutes < end
      : minutes >= start || minutes < end;
  });
}

export function humanDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400) {
    const h = Math.floor(seconds / 3600);
    const m = Math.round((seconds % 3600) / 60);
    return m ? `${h}h ${m}m` : `${h}h`;
  }
  const d = Math.floor(seconds / 86400);
  const h = Math.round((seconds % 86400) / 3600);
  return h ? `${d}d ${h}h` : `${d}d`;
}
