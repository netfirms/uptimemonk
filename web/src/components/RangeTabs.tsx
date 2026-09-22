"use client";

/**
 * The window a chart is showing.
 *
 * Shared between the dashboard and the public status page so the two offer the
 * same four windows and label them the same way. The values match the server's
 * `RANGES` keys and are sent through verbatim.
 */

export const RANGES = [
  { key: "24h", label: "24h", full: "Last 24 hours" },
  { key: "7d", label: "7d", full: "Last 7 days" },
  { key: "30d", label: "30d", full: "Last 30 days" },
  { key: "90d", label: "90d", full: "Last 90 days" },
] as const;

export type RangeKey = (typeof RANGES)[number]["key"];

/**
 * Mirrors `DEFAULT_RANGE` in `server/src/lib/ranges.ts`, which is what the API
 * falls back to when a request carries no `range`.
 *
 * 24h because a status page answers "is it working right now". A visitor
 * arrives during an outage, and a 90-day window averages that outage down to
 * a rounding error — the page looks green while the service is down. The
 * longer windows are still one tap away for anyone asking a different
 * question.
 */
export const DEFAULT_RANGE: RangeKey = "24h";

export const rangeLabel = (key: RangeKey) =>
  RANGES.find((r) => r.key === key)?.full ?? key;

export default function RangeTabs({
  value,
  onChange,
  disabled,
}: {
  value: RangeKey;
  onChange: (key: RangeKey) => void;
  disabled?: boolean;
}) {
  return (
    <div className="range-tabs" role="tablist" aria-label="Time range">
      {RANGES.map((r) => (
        <button
          key={r.key}
          type="button"
          role="tab"
          aria-selected={value === r.key}
          aria-label={r.full}
          className={value === r.key ? "active" : ""}
          disabled={disabled}
          onClick={() => onChange(r.key)}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
