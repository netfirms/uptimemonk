"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api, ApiError, type MonitorHistory, type Bucket, type Point } from "@/lib/api";
import { MonitorTypeIcon } from "./NewMonitorForm";
import RangeTabs, { rangeLabel, type RangeKey } from "@/components/RangeTabs";
import { useI18n } from "@/lib/i18n/context";

/**
 * Monitor detail: uptime history, response times and past incidents.
 *
 * One request to the worker, served from its local SQLite. Per-check history
 * deliberately never reaches Firestore — that is what keeps the Firestore write
 * bill independent of monitor count — so there is nothing to subscribe to and
 * the panel fetches on open.
 */

const fmtMs = (ms: number | null | undefined) =>
  ms == null ? "—" : ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${Math.round(ms)}ms`;

const fmtPct = (n: number | null | undefined) => (n == null ? "—" : `${n.toFixed(2)}%`);

/** Matches the latency colours used on the monitor list. */
const latencyClass = (ms: number | null | undefined) =>
  ms == null ? "" : ms < 300 ? "latency-fast" : ms < 1000 ? "latency-med" : "latency-slow";

/** Exported so the dashboard's incident feed formats the same way. Two
 *  copies of this would drift the moment one of them gained a "d" unit. */
export function fmtDuration(seconds?: number) {
  if (seconds == null) return "—";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return m ? `${h}h ${m}m` : `${h}h`;
}

function fmtWhen(ms: number | null | undefined) {
  if (ms == null) return "—";
  const diff = Date.now() - ms;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(ms).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtDay(day: string) {
  return new Date(
    Number(day.slice(0, 4)),
    Number(day.slice(4, 6)) - 1,
    Number(day.slice(6, 8))
  ).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** A bucket's start, in the viewer's own timezone. The server sends instants,
 *  not formatted UTC strings, precisely so this can be local. */
function fmtBucket(t: number, granularity: "hour" | "day") {
  const d = new Date(t);
  return granularity === "hour"
    ? d.toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit" })
    : d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/**
 * The uptime bar, using the same `data-state` vocabulary as the rest of the app.
 *
 * Buckets before the monitor existed render as "none" rather than as failures —
 * a monitor created last week has not been down for the previous 83 days, and
 * showing red there would be a lie the eye reads first. The padding target is
 * the range's own bucket count, so a 24h view pads to 24 and not to 90.
 */
function UptimeBars({
  buckets,
  granularity,
  expected,
}: {
  buckets: Bucket[];
  granularity: "hour" | "day";
  expected: number;
}) {
  const padding = Math.max(0, expected - buckets.length);
  const unit = granularity === "hour" ? "hourly" : "daily";

  if (!buckets.length) {
    return (
      <div className="detail-empty">
        <p>
          No {unit} history in this window yet
          {granularity === "day" ? " — the first rollup runs at 00:15 UTC." : "."}
        </p>
        <p className="dim">Try a shorter range, or check back once more data lands.</p>
      </div>
    );
  }

  return (
    <div className="bars-wrap">
      <div className="bars">
        {Array.from({ length: padding }).map((_, i) => (
          <span key={`pad-${i}`} data-state="none" title="No data" />
        ))}
        {buckets.map((b) => {
          const pct = b.uptimeRatio * 100;
          const state = pct >= 99.9 ? "up" : pct >= 95 ? "partial" : "down";
          return (
            <span
              key={b.t}
              data-state={state}
              title={`${fmtBucket(b.t, granularity)} · ${pct.toFixed(2)}% · ${
                b.up + b.down
              } checks`}
            />
          );
        })}
      </div>
      <div className="detail-axis">
        <span>{fmtBucket(buckets[0].t, granularity)}</span>
        <span>{fmtBucket(buckets[buckets.length - 1].t, granularity)}</span>
      </div>
    </div>
  );
}

/**
 * Response times as an inline SVG.
 *
 * The line breaks at every failed check and a red band is drawn there instead.
 * A continuous line across an outage would imply the service was responding
 * through it, which is the opposite of what this chart exists to show.
 */
function ResponseChart({ samples }: { samples: Point[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const shape = useMemo(() => {
    if (samples.length < 2) return null;
    const W = 680;
    const H = 140;
    const PAD_X = 2;
    const PAD_Y = 10;
    const oks = samples.filter((s) => s.ok);
    const max = Math.max(1, ...oks.map((s) => s.ms));
    const t0 = samples[0].t;
    const span = Math.max(1, samples[samples.length - 1].t - t0);

    const x = (t: number) => PAD_X + ((t - t0) / span) * (W - PAD_X * 2);
    const y = (ms: number) => H - PAD_Y - (ms / max) * (H - PAD_Y * 2);

    const lines: string[] = [];
    const areas: string[] = [];
    let run: Array<[number, number]> = [];
    const flush = () => {
      if (run.length > 1) {
        lines.push(run.map(([a, b]) => `${a},${b}`).join(" "));
        areas.push(
          `${run[0][0]},${H - PAD_Y} ` +
            run.map(([a, b]) => `${a},${b}`).join(" ") +
            ` ${run[run.length - 1][0]},${H - PAD_Y}`
        );
      }
      run = [];
    };
    for (const s of samples) {
      if (s.ok) run.push([Number(x(s.t).toFixed(1)), Number(y(s.ms).toFixed(1))]);
      else flush();
    }
    flush();

    const avg = oks.length ? oks.reduce((a, s) => a + s.ms, 0) / oks.length : 0;
    // Index rather than the sample, so the marker and the hover readout share
    // one code path.
    let peakIndex = -1;
    samples.forEach((s, i) => {
      if (s.ok && (peakIndex < 0 || s.ms > samples[peakIndex].ms)) peakIndex = i;
    });

    return {
      W, H, PAD_X, PAD_Y, max, avg, lines, areas, x, y, t0, span, peakIndex,
      avgY: y(avg),
      // Merge consecutive failures into one band. Drawing a bar per failed
      // sample rendered a ten-minute outage as a barcode of separate stripes,
      // which reads as flapping rather than as one continuous outage.
      fails: (() => {
        const bands: Array<{ x: number; w: number }> = [];
        let from: number | null = null;
        let to = 0;
        samples.forEach((sm, i) => {
          if (!sm.ok) {
            if (from === null) from = x(sm.t);
            to = x(sm.t);
            if (i === samples.length - 1) bands.push({ x: from, w: Math.max(3, to - from) });
          } else if (from !== null) {
            bands.push({ x: from, w: Math.max(3, to - from) });
            from = null;
          }
        });
        return bands;
      })(),
    };
  }, [samples]);

  /**
   * Nearest sample to the pointer, found by time rather than by index —
   * samples are not evenly spaced once a worker restarts or a check is
   * skipped, so index arithmetic would drift from what is drawn.
   */
  function handleMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!shape || !wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    if (!rect.width) return;
    const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const target = shape.t0 + frac * shape.span;

    let best = 0;
    let bestGap = Infinity;
    samples.forEach((s, i) => {
      const gap = Math.abs(s.t - target);
      if (gap < bestGap) {
        bestGap = gap;
        best = i;
      }
    });
    setHover(best);
  }

  if (!shape) {
    return (
      <div className="detail-empty">
        <p>Not enough checks yet to draw a chart.</p>
      </div>
    );
  }

  const { W, H, PAD_X, PAD_Y, max, avg, lines, areas, avgY, fails, peakIndex } = shape;

  // Percentages, not SVG units: the SVG stretches with
  // preserveAspectRatio="none", so a circle drawn inside it would render as an
  // ellipse. Overlaying HTML keeps the markers round at any width.
  const pct = (i: number) => {
    const s = samples[i];
    return {
      left: `${(shape.x(s.t) / W) * 100}%`,
      top: `${(shape.y(s.ok ? s.ms : 0) / H) * 100}%`,
    };
  };

  const active = hover != null ? samples[hover] : null;
  const peak = peakIndex >= 0 ? samples[peakIndex] : null;
  // Flip the tooltip to the left near the right edge so it cannot overflow.
  const tipRight = hover != null && shape.x(samples[hover].t) / W > 0.62;

  return (
    <div className="detail-chart">
      <div
        className="chart-plot"
        ref={wrapRef}
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={`Response time across ${samples.length} checks, averaging ${fmtMs(
            avg
          )}, peaking at ${fmtMs(max)}`}
        >
          <defs>
            <linearGradient id="respFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.28" />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {fails.map((band, i) => (
            <rect
              key={`f${i}`}
              x={band.x - 1.5}
              y={PAD_Y / 2}
              width={band.w}
              height={H - PAD_Y}
              fill="var(--down)"
              opacity="0.4"
            />
          ))}

          {areas.map((pts, i) => (
            <polygon key={`a${i}`} points={pts} fill="url(#respFill)" />
          ))}
          {lines.map((pts, i) => (
            <polyline
              key={`l${i}`}
              points={pts}
              fill="none"
              stroke="var(--primary)"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          ))}

          <line
            x1={PAD_X}
            y1={avgY}
            x2={W - PAD_X}
            y2={avgY}
            stroke="var(--text-dim)"
            strokeWidth="1"
            strokeDasharray="4 4"
            vectorEffect="non-scaling-stroke"
          />

          {active && (
            <line
              x1={shape.x(active.t)}
              y1={0}
              x2={shape.x(active.t)}
              y2={H}
              stroke="var(--text-muted)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>

        {/* Peak marker. Hidden while hovering so the two readouts never
            overlap and argue about which value is which. */}
        {peak && hover == null && (
          <>
            <span className="chart-dot chart-dot-peak" style={pct(peakIndex)} />
            <span
              className="chart-peak-label"
              style={{
                ...pct(peakIndex),
                transform:
                  shape.x(peak.t) / W > 0.8
                    ? "translate(-100%, -150%)"
                    : "translate(-50%, -150%)",
              }}
            >
              peak {fmtMs(peak.ms)}
            </span>
          </>
        )}

        {active && (
          <>
            <span
              className={`chart-dot ${active.ok ? "" : "chart-dot-fail"}`}
              style={pct(hover!)}
            />
            <div
              className="chart-tooltip"
              style={{
                left: `${(shape.x(active.t) / W) * 100}%`,
                transform: tipRight ? "translate(-100%, 0)" : "translate(0, 0)",
              }}
            >
              <div className="chart-tooltip-value">
                {active.ok ? fmtMs(active.ms) : "Failed"}
              </div>
              <div className="chart-tooltip-meta">
                {new Date(active.t).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
                {active.code ? ` · HTTP ${active.code}` : ""}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="detail-axis">
        <span>
          {new Date(samples[0].t).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
        <span className="dim">
          avg {fmtMs(avg)} · peak {fmtMs(max)} · {samples.length} checks
        </span>
        <span>
          {new Date(samples[samples.length - 1].t).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
    </div>
  );
}

/** How many bars a full window has — the padding target, matching the
 *  server's `RANGES`. Padding to 90 in a 24h view would draw 66 empty bars. */
const BUCKETS_PER_RANGE: Record<RangeKey, number> = {
  "24h": 24,
  "7d": 168,
  "30d": 30,
  "90d": 90,
};

/**
 * The certificate's validity window.
 *
 * A bar rather than two dates, because "expires 2 Dec" means nothing without
 * knowing the cert is ninety days long — the same date is comfortable on a
 * one-year cert and alarming on a Let's Encrypt one. The fill shows how much
 * of the life is spent.
 */
function CertPanel({
  issuedAt,
  expiresAt,
  issuer,
}: {
  issuedAt: number | null;
  expiresAt: number;
  issuer: string | null;
}) {
  const now = Date.now();
  const daysLeft = Math.floor((expiresAt - now) / 86_400_000);
  const state = daysLeft < 0 ? "down" : daysLeft <= 7 ? "down" : daysLeft <= 30 ? "warn" : "ok";

  const span = issuedAt ? expiresAt - issuedAt : null;
  const used = issuedAt ? Math.min(100, Math.max(0, ((now - issuedAt) / span!) * 100)) : null;

  const date = (ms: number) =>
    new Date(ms).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  return (
    <div className="cert-panel">
      <div className="row-between">
        <strong className={`cert-left ${state}`}>
          {daysLeft < 0
            ? `Expired ${Math.abs(daysLeft)} days ago`
            : daysLeft === 0
              ? "Expires today"
              : daysLeft === 1
                ? "Expires tomorrow"
                : `${daysLeft} days left`}
        </strong>
        {issuer && <span className="dim">{issuer}</span>}
      </div>

      {used != null && (
        <div className="cert-bar">
          <span className={state} style={{ width: `${used}%` }} />
        </div>
      )}

      <div className="detail-axis">
        <span>{issuedAt ? `Valid from ${date(issuedAt)}` : "Issue date unknown"}</span>
        <span>Until {date(expiresAt)}</span>
      </div>
    </div>
  );
}

export default function MonitorDetail({
  monitorId,
  onClose,
}: {
  monitorId: string | null;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [data, setData] = useState<MonitorHistory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [range, setRange] = useState<RangeKey>("24h");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeSnippetTab, setActiveSnippetTab] = useState<"curl" | "crontab" | "python" | "fail">("curl");

  const copySnippet = (text: string, key: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
    }
    setCopiedKey(key);
    setTimeout(() => setCopiedKey((curr) => (curr === key ? null : curr)), 2500);
  };

  // Reset to the default window when a different monitor is opened; keeping
  // the last one would silently answer a question about the previous monitor.
  useEffect(() => {
    if (monitorId) setRange("24h");
  }, [monitorId]);

  useEffect(() => {
    if (!monitorId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    // The previous range's data is deliberately kept on screen while the next
    // one loads: blanking the panel on every tab click makes switching windows
    // feel like reopening the monitor.

    api
      .history(monitorId, { range })
      .then((h) => !cancelled && setData(h))
      .catch(
        (err) =>
          !cancelled &&
          setError(
            err instanceof ApiError ? err.message : "Could not load this monitor's history."
          )
      )
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [monitorId, range]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && monitorId && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [monitorId, onClose]);

  if (!monitorId) return null;
  const m = data?.monitor;
  const status = m?.status ?? "pending";

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content detail-modal" role="dialog" aria-modal="true">
        <div className="modal-header detail-header">
          <div className="detail-title">
            <span className="monitor-type-badge">
              <MonitorTypeIcon type={m?.type ?? "http"} size={18} />
            </span>
            <div style={{ minWidth: 0 }}>
              <h2 className="detail-name">{m?.name ?? "Monitor"}</h2>
              <div className="detail-sub">
                <span className="detail-target">{m?.target || m?.type}</span>
                {m && (
                  <span className="interval-tag">
                    every {Math.round(m.intervalSeconds / 60)}m
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="detail-header-right">
            {m && (
              <span className={`status-pill ${status}`}>
                <span className={`status-dot ${status}`} />
                {status}
              </span>
            )}
            <button
              type="button"
              className="btn-sm"
              onClick={onClose}
              style={{ padding: "6px 8px", borderRadius: "50%" }}
              aria-label="Close details"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        <div className="modal-body">
          {loading && <p className="dim">Loading history…</p>}
          {error && (
            <div className="detail-error" role="alert">
              {error}
            </div>
          )}

          {data && m && (
            <>
              {m.lastError && status === "down" && (
                <div className="detail-error" role="status">
                  <strong>Currently failing:</strong> {m.lastError}
                </div>
              )}

              <div className="detail-stats">
                <div className="detail-stat">
                  <span className="stat-title">24 hours</span>
                  <span className="stat-num">{fmtPct(m.uptime24h)}</span>
                </div>
                <div className="detail-stat">
                  <span className="stat-title">7 days</span>
                  <span className="stat-num">{fmtPct(m.uptime7d)}</span>
                </div>
                <div className="detail-stat">
                  <span className="stat-title">30 days</span>
                  <span className="stat-num">{fmtPct(m.uptime30d)}</span>
                </div>
                <div className="detail-stat">
                  <span className="stat-title">{t("detailAvgResponse")}</span>
                  <span className={`stat-num ${latencyClass(data.summary.avgMs)}`}>
                    {fmtMs(data.summary.avgMs)}
                  </span>
                </div>
                <div className="detail-stat">
                  <span className="stat-title">Checks</span>
                  <span className="stat-num">{data.summary.checks.toLocaleString()}</span>
                </div>
                <div className="detail-stat">
                  <span className="stat-title">Last check</span>
                  <span className="stat-num detail-stat-sm">{fmtWhen(m.lastCheckedAt)}</span>
                </div>
              </div>

              {m.type === "heartbeat" && m.heartbeatToken && (
                <section
                  className="detail-section"
                  style={{
                    background: "rgba(15, 23, 42, 0.6)",
                    border: "1px solid rgba(59, 130, 246, 0.25)",
                    borderRadius: "10px",
                    padding: "16px 18px",
                    marginTop: "16px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", flexWrap: "wrap", marginBottom: "12px" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: "1.1rem" }}>⚡</span>
                        <h3 style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text)", margin: 0 }}>
                          Heartbeat / Cron Ingestion Endpoint
                        </h3>
                      </div>
                      <p className="dim" style={{ fontSize: "0.8rem", marginTop: "4px" }}>
                        Ping this URL periodically from your background job, cron script, or worker. Expected at least every {Math.round(m.intervalSeconds / 60)}m {m.heartbeatGraceSeconds ? `(+${m.heartbeatGraceSeconds}s grace)` : ""}.
                      </p>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span className="interval-tag" style={{ background: "rgba(59, 130, 246, 0.15)", color: "#60a5fa", border: "1px solid rgba(59, 130, 246, 0.3)" }}>
                        Token: {m.heartbeatToken.slice(0, 8)}…
                      </span>
                    </div>
                  </div>

                  {/* Primary URL Bar */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      background: "rgba(0, 0, 0, 0.4)",
                      border: "1px solid var(--border)",
                      borderRadius: "6px",
                      padding: "8px 12px",
                      marginBottom: "14px",
                    }}
                  >
                    <span style={{ fontSize: "0.75rem", color: "var(--primary)", fontWeight: 600 }}>GET/POST</span>
                    <code
                      style={{
                        flex: 1,
                        fontFamily: "var(--font-mono, monospace)",
                        fontSize: "0.8rem",
                        color: "var(--text)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      https://api.uptimemonke.com/heartbeat/{m.heartbeatToken}
                    </code>
                    <button
                      type="button"
                      className="btn-sm"
                      onClick={() => copySnippet(`https://api.uptimemonke.com/heartbeat/${m.heartbeatToken}`, "url")}
                      style={{
                        background: copiedKey === "url" ? "rgba(16, 185, 129, 0.2)" : "var(--primary)",
                        color: copiedKey === "url" ? "#10b981" : "#fff",
                        borderColor: copiedKey === "url" ? "rgba(16, 185, 129, 0.5)" : "transparent",
                        padding: "4px 10px",
                        fontSize: "0.75rem",
                      }}
                    >
                      {copiedKey === "url" ? "✓ Copied!" : "Copy URL"}
                    </button>
                  </div>

                  {/* Code Snippet Tabs */}
                  <div style={{ borderTop: "1px solid rgba(255, 255, 255, 0.08)", paddingTop: "12px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px", flexWrap: "wrap", gap: "6px" }}>
                      <div style={{ display: "flex", gap: "6px" }}>
                        {(
                          [
                            { id: "curl", label: "cURL / Shell" },
                            { id: "crontab", label: "Crontab" },
                            { id: "python", label: "Python" },
                            { id: "fail", label: "Report Failure (POST)" },
                          ] as const
                        ).map((tab) => (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveSnippetTab(tab.id)}
                            style={{
                              background: activeSnippetTab === tab.id ? "rgba(255, 255, 255, 0.12)" : "transparent",
                              color: activeSnippetTab === tab.id ? "var(--text)" : "var(--text-dim)",
                              border: "none",
                              borderRadius: "4px",
                              padding: "4px 8px",
                              fontSize: "0.75rem",
                              cursor: "pointer",
                              fontWeight: activeSnippetTab === tab.id ? 600 : 400,
                            }}
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>

                      <button
                        type="button"
                        className="btn-xs"
                        onClick={() => {
                          const code =
                            activeSnippetTab === "curl"
                              ? `curl -fsS -m 10 --retry 3 https://api.uptimemonke.com/heartbeat/${m.heartbeatToken}`
                              : activeSnippetTab === "crontab"
                              ? `0 * * * * /path/to/backup.sh && curl -fsS -m 10 https://api.uptimemonke.com/heartbeat/${m.heartbeatToken}`
                              : activeSnippetTab === "python"
                              ? `import urllib.request\n\n# Ping upon successful completion\nurllib.request.urlopen("https://api.uptimemonke.com/heartbeat/${m.heartbeatToken}", timeout=10)`
                              : `curl -X POST https://api.uptimemonke.com/heartbeat/${m.heartbeatToken} \\\n  -H "Content-Type: application/json" \\\n  -d '{"status":"fail","error":"Job crashed"}'`;
                          copySnippet(code, activeSnippetTab);
                        }}
                        style={{
                          background: copiedKey === activeSnippetTab ? "rgba(16, 185, 129, 0.15)" : "rgba(255, 255, 255, 0.06)",
                          border: `1px solid ${copiedKey === activeSnippetTab ? "rgba(16, 185, 129, 0.4)" : "var(--border)"}`,
                          color: copiedKey === activeSnippetTab ? "#10b981" : "var(--text-dim)",
                          borderRadius: "4px",
                          padding: "3px 8px",
                          fontSize: "0.72rem",
                          cursor: "pointer",
                        }}
                      >
                        {copiedKey === activeSnippetTab ? "✓ Copied Snippet!" : "Copy Snippet"}
                      </button>
                    </div>

                    <pre
                      style={{
                        background: "rgba(0, 0, 0, 0.5)",
                        border: "1px solid rgba(255, 255, 255, 0.06)",
                        borderRadius: "6px",
                        padding: "10px 12px",
                        fontFamily: "var(--font-mono, monospace)",
                        fontSize: "0.78rem",
                        lineHeight: 1.45,
                        color: "#cbd5e1",
                        margin: 0,
                        overflowX: "auto",
                      }}
                    >
                      {activeSnippetTab === "curl" &&
                        `curl -fsS -m 10 --retry 3 https://api.uptimemonke.com/heartbeat/${m.heartbeatToken}`}
                      {activeSnippetTab === "crontab" &&
                        `# Append to crontab:\n0 * * * * /path/to/backup.sh && curl -fsS -m 10 https://api.uptimemonke.com/heartbeat/${m.heartbeatToken}`}
                      {activeSnippetTab === "python" &&
                        `import urllib.request\n\n# Ping upon successful completion\nurllib.request.urlopen("https://api.uptimemonke.com/heartbeat/${m.heartbeatToken}", timeout=10)`}
                      {activeSnippetTab === "fail" &&
                        `curl -X POST https://api.uptimemonke.com/heartbeat/${m.heartbeatToken} \\\n  -H "Content-Type: application/json" \\\n  -d '{"status":"fail","error":"Job crashed"}'`}
                    </pre>
                  </div>
                </section>
              )}

              {m.certExpiresAt != null && (
                <section className="detail-section">
                  <div className="detail-section-head">
                    <h3>Certificate</h3>
                    {!!data.monitor.sslExpiryAlertDays?.length && (
                      <span className="dim">
                        warns at {data.monitor.sslExpiryAlertDays.join(", ")} days
                      </span>
                    )}
                  </div>
                  <CertPanel
                    issuedAt={m.certIssuedAt}
                    expiresAt={m.certExpiresAt}
                    issuer={m.certIssuer}
                  />
                </section>
              )}

              <section className="detail-section">
                <div className="detail-section-head">
                  <h3>{t("detailUptime")}</h3>
                  <RangeTabs value={range} onChange={setRange} disabled={loading} />
                </div>
                <UptimeBars
                  buckets={data.buckets}
                  granularity={data.granularity}
                  expected={BUCKETS_PER_RANGE[range]}
                />
              </section>

              <section className="detail-section">
                <div className="detail-section-head">
                  <h3>{t("detailTabResponseTime")}</h3>
                  <span className="dim">{rangeLabel(range)}</span>
                </div>
                <ResponseChart samples={data.points} />
              </section>

              <section className="detail-section">
                <div className="detail-section-head">
                  <h3>{t("detailTabIncidents")}</h3>
                  {!!data.incidents.length && (
                    <span className="dim">{data.incidents.length} recorded</span>
                  )}
                </div>
                {!data.incidents.length ? (
                  <div className="detail-empty">
                    <p>{t("detailNoIncidents")}</p>
                  </div>
                ) : (
                  <div className="detail-incidents">
                    {data.incidents.map((i) => (
                      <div key={i.id} className="detail-incident">
                        <span
                          className={`status-dot ${i.status === "open" ? "down" : "up"}`}
                          aria-hidden="true"
                        />
                        <div className="grow" style={{ minWidth: 0 }}>
                          <div className="detail-incident-cause">{i.cause}</div>
                          <div className="dim">{fmtWhen(i.startedAt)}</div>
                        </div>
                        <span
                          className={
                            i.status === "open" ? "detail-ongoing" : "interval-tag"
                          }
                        >
                          {i.status === "open" ? "ongoing" : fmtDuration(i.durationSeconds)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
