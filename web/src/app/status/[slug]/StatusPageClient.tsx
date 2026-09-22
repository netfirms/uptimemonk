"use client";

import { useEffect, useState } from "react";
import { API_URL } from "@/lib/api";
import RangeTabs, { rangeLabel, type RangeKey } from "@/components/RangeTabs";

interface Bucket {
  /** Start of the bucket, epoch ms. */
  t: number;
  up: number;
  down: number;
  avgMs: number;
  uptimeRatio: number;
}

interface PublicMonitor {
  id: string;
  name: string;
  status: string;
  uptime30d?: number;
  lastCheckedAt?: number;
  buckets: Bucket[];
}

interface PublicStatus {
  title: string;
  description?: string;
  updatedAt: number;
  range: RangeKey;
  granularity: "hour" | "day";
  monitors: PublicMonitor[];
}

/** How often a visitor left on the page picks up a change. */
const POLL_MS = 60_000;

/**
 * The slug comes from the address bar, not from the route params.
 *
 * Only one shell is prerendered, so `useParams()` would always report the
 * placeholder. Hosting rewrites every `/status/<slug>` onto that shell, which
 * leaves the real slug in the path.
 */
function slugFromPath(): string {
  if (typeof window === "undefined") return "";
  const parts = window.location.pathname.replace(/\/+$/, "").split("/");
  const last = parts[parts.length - 1] ?? "";
  return last === "_shell" || last === "status" ? "" : decodeURIComponent(last);
}

/** Bars in a full window, matching the server's `RANGES`. */
const BUCKETS_PER_RANGE: Record<RangeKey, number> = {
  "24h": 24,
  "7d": 168,
  "30d": 30,
  "90d": 90,
};

export default function StatusPageClient() {
  const [page, setPage] = useState<PublicStatus | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [range, setRange] = useState<RangeKey>("90d");

  useEffect(() => {
    const slug = slugFromPath();
    if (!slug) {
      setState("missing");
      return;
    }

    let live = true;

    const load = async () => {
      try {
        const res = await fetch(
          `${API_URL}/v1/status/${encodeURIComponent(slug)}?range=${range}`
        );
        if (!live) return;
        if (res.status === 404) return setState("missing");
        if (!res.ok) throw new Error(String(res.status));
        setPage((await res.json()) as PublicStatus);
        setState("ready");
      } catch {
        if (!live) return;
        // Keep showing the last good render rather than replacing a working
        // page with an error because one poll failed.
        setState((s) => (s === "ready" ? "ready" : "error"));
      }
    };

    void load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [range]);

  useEffect(() => {
    if (!page) return;
    // The org-id fallback has no custom title and defaults to "Service
    // status", which appending to gave "Service status status".
    document.title = /status$/i.test(page.title) ? page.title : `${page.title} status`;
  }, [page]);

  if (state === "loading") return <Shell>Loading status…</Shell>;
  if (state === "missing") {
    return (
      <Shell>
        No status page here. The owner may not have published one yet.
      </Shell>
    );
  }
  if (state === "error" || !page) {
    return <Shell>Status is temporarily unavailable. Retrying…</Shell>;
  }

  const down = page.monitors.filter((m) => m.status === "down");
  const allUp = down.length === 0;

  return (
    <main className="wrap">
      <header className="topbar status-page-topbar">
        <div className="brand-badge">
          <span className="brand-robot">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/mascot-128.png" alt="" width={56} height={56} />
          </span>
          <span>{page.title}</span>
        </div>
        <span className={`status-pill ${allUp ? "up" : "down"}`}>
          <span className={`status-dot ${allUp ? "up" : "down"}`} />
          {allUp ? "Operational" : "Degraded"}
        </span>
      </header>

      <div
        className="card"
        style={{
          marginBottom: 24,
          padding: 24,
          background: allUp
            ? "linear-gradient(135deg, rgba(111,195,223,.12) 0%, rgba(13,20,28,.95) 100%)"
            : "linear-gradient(135deg, rgba(239,68,68,.15) 0%, rgba(13,20,28,.95) 100%)",
          border: `1px solid ${allUp ? "rgba(111,195,223,.35)" : "rgba(239,68,68,.35)"}`,
        }}
      >
        <div className="row">
          <div className="status-dot-container">
            <span className={`pulse-ring ${allUp ? "up" : "down"}`} />
            <span className={`status-dot ${allUp ? "up" : "down"}`} />
          </div>
          <div>
            <h1 style={{ fontSize: "1.3rem", fontWeight: 700 }}>
              {allUp
                ? "All systems operational"
                : down.length === 1
                  ? `${down[0].name} is down`
                  : `${down.length} services are down`}
            </h1>
            <p className="muted" style={{ marginTop: 4 }}>
              {page.description || "Live service health and uptime history."}
            </p>
          </div>
          <div className="status-range">
            <RangeTabs value={range} onChange={setRange} />
          </div>
        </div>
      </div>

      <div className="monitor-list">
        {page.monitors.map((m) => (
          <section key={m.id} className="card">
            <div className="row-between" style={{ marginBottom: 14 }}>
              <div className="row">
                <span className={`status-dot ${m.status}`} />
                <strong style={{ fontSize: "1rem" }}>{m.name}</strong>
              </div>
              <div className="row">
                {m.uptime30d != null && (
                  <span className="dim font-mono">{m.uptime30d.toFixed(2)}% · 30d</span>
                )}
                <span className={`status-pill ${m.status}`}>{m.status}</span>
              </div>
            </div>

            <div className="bars-wrap">
              <div
                className="bars"
                aria-label={`${m.name}: uptime over the ${rangeLabel(page.range).toLowerCase()}`}
              >
                {pad(m.buckets, BUCKETS_PER_RANGE[page.range]).map((b, i) => (
                  <span
                    key={i}
                    data-state={stateOf(b)}
                    title={
                      b
                        ? `${fmtBucket(b.t, page.granularity)}: ${(
                            b.uptimeRatio * 100
                          ).toFixed(2)}%`
                        : "No data"
                    }
                  />
                ))}
              </div>
              <div
                className="row-between dim"
                style={{ marginTop: 6, fontSize: "0.75rem" }}
              >
                <span>
                  {m.buckets.length
                    ? fmtBucket(m.buckets[0].t, page.granularity)
                    : rangeLabel(page.range)}
                </span>
                <span>Now</span>
              </div>
            </div>
          </section>
        ))}
      </div>

      <footer className="app-footer">
        <span>
          Powered by <strong>UptimeMonke</strong>
        </span>
        <span>{updatedLabel(page.updatedAt)}</span>
      </footer>
    </main>
  );
}

/** The frame shared by every non-data state, so the page never renders blank. */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="wrap">
      <header className="topbar">
        <div className="brand-badge">
          <span className="brand-robot">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/mascot-128.png" alt="" width={56} height={56} />
          </span>
          <span>Status</span>
        </div>
      </header>
      <div className="card" style={{ padding: 32, textAlign: "center" }}>
        <p className="muted">{children}</p>
      </div>
    </main>
  );
}

function updatedLabel(at: number): string {
  const secs = Math.max(0, Math.round((Date.now() - at) / 1000));
  if (secs < 90) return "Updated just now";
  return `Updated ${Math.round(secs / 60)} min ago`;
}

/** Left-pad with blanks so a young monitor's bars still end at now. */
function pad(buckets: Bucket[], n: number): (Bucket | null)[] {
  return [...Array(Math.max(0, n - buckets.length)).fill(null), ...buckets.slice(-n)];
}

/** The server sends instants, not formatted UTC strings, so a visitor in any
 *  timezone reads the hour they actually experienced. */
function fmtBucket(t: number, granularity: "hour" | "day"): string {
  const d = new Date(t);
  return granularity === "hour"
    ? d.toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit" })
    : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function stateOf(b: Bucket | null): string {
  if (!b) return "none";
  if (b.uptimeRatio >= 0.999) return "up";
  if (b.uptimeRatio >= 0.95) return "partial";
  return "down";
}
