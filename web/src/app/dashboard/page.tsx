"use client";

import { useEffect, useState, useMemo } from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  type User,
} from "firebase/auth";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { api, ApiError } from "@/lib/api";
import NewMonitorForm, { MonitorTypeIcon, type MonitorType } from "./NewMonitorForm";

type Status = "up" | "down" | "pending" | "paused";

interface MonitorConfig {
  id: string;
  name: string;
  target: string;
  type: MonitorType | string;
  intervalSeconds?: number;
  enabled?: boolean;
}

interface LiveState {
  status: Status;
  inMaintenance?: boolean;
  lastResponseTimeMs?: number | null;
  lastError?: string | null;
  uptime30d?: number | null;
}

export default function Dashboard() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [monitors, setMonitors] = useState<MonitorConfig[]>([]);
  const [live, setLive] = useState<Record<string, LiveState>>({});
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "up" | "down" | "paused">("all");

  useEffect(
    () =>
      onAuthStateChanged(auth, async (u) => {
        setCurrentUser(u);
        if (!u) return setOrgId(null);

        let token = await u.getIdTokenResult();
        let id = (token.claims.orgId as string) ?? null;

        if (!id) {
          // Force refresh token to pick up newly assigned claims from backend or bootstrap
          token = await u.getIdTokenResult(true);
          id = (token.claims.orgId as string) ?? null;
        }

        if (!id) {
          try {
            const { orgId: created } = await api.bootstrap();
            await u.getIdToken(true);
            id = created;
          } catch (err) {
            console.error("Workspace setup error:", err);
            setError(
              err instanceof ApiError
                ? err.message
                : "Could not set up your workspace automatically. Try reloading or contact support."
            );
          }
        }
        setOrgId(id);
      }),
    []
  );

  // Configuration listener.
  useEffect(() => {
    if (!orgId) return;
    return onSnapshot(
      query(collection(db, "monitors"), where("orgId", "==", orgId)),
      (snap) =>
        setMonitors(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() }) as MonitorConfig)
            .sort((a, b) => a.name.localeCompare(b.name))
        ),
      () => setError("Lost the connection to your monitor list.")
    );
  }, [orgId]);

  // Live state listener.
  useEffect(() => {
    if (!orgId) return;
    return onSnapshot(
      doc(db, "orgStatus", orgId),
      (snap) => setLive((snap.data()?.monitors ?? {}) as Record<string, LiveState>),
      () => setError("Lost the live status feed.")
    );
  }, [orgId]);

  async function togglePause(m: MonitorConfig) {
    setBusyId(m.id);
    setError(null);
    try {
      await api.togglePause(m.id, m.enabled !== false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update that monitor.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(m: MonitorConfig) {
    if (!window.confirm(`Are you sure you want to delete monitor "${m.name}"?`)) return;
    setBusyId(m.id);
    setError(null);
    try {
      await api.deleteMonitor(m.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete that monitor.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleGoogleSignIn() {
    setAuthError(null);
    setIsSigningIn(true);
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (err: unknown) {
      console.error("Sign in failed:", err);
      const code = (err as { code?: string })?.code;
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
        // User closed popup intentionally, no error needed
      } else if (code === "auth/popup-blocked") {
        setAuthError("Sign-in popup was blocked by your browser. Please allow popups for this site and try again.");
      } else if (code === "auth/unauthorized-domain") {
        setAuthError("This domain is not authorized for sign-in. Please contact support.");
      } else {
        setAuthError((err as Error)?.message || "Failed to sign in with Google.");
      }
    } finally {
      setIsSigningIn(false);
    }
  }

  const statusOf = (m: MonitorConfig): Status => {
    if (m.enabled === false) return "paused";
    return live[m.id]?.status ?? "pending";
  };

  // Metrics computation
  const stats = useMemo(() => {
    const total = monitors.length;
    let upCount = 0;
    let downCount = 0;
    let pausedCount = 0;
    let totalLatency = 0;
    let latencyCount = 0;
    let totalUptime = 0;
    let uptimeCount = 0;

    monitors.forEach((m) => {
      const s = statusOf(m);
      if (s === "up") upCount++;
      else if (s === "down") downCount++;
      else if (s === "paused") pausedCount++;

      const l = live[m.id];
      if (l?.lastResponseTimeMs != null && l.lastResponseTimeMs > 0) {
        totalLatency += l.lastResponseTimeMs;
        latencyCount++;
      }
      if (l?.uptime30d != null) {
        totalUptime += l.uptime30d;
        uptimeCount++;
      }
    });

    const avgLatency = latencyCount > 0 ? Math.round(totalLatency / latencyCount) : null;
    const avgUptime = uptimeCount > 0 ? (totalUptime / uptimeCount).toFixed(2) : "100.00";

    return { total, upCount, downCount, pausedCount, avgLatency, avgUptime };
  }, [monitors, live]);

  // Filtered list
  const filteredMonitors = useMemo(() => {
    return monitors.filter((m) => {
      const s = statusOf(m);
      if (activeTab !== "all" && s !== activeTab) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          m.name.toLowerCase().includes(q) ||
          (m.target && m.target.toLowerCase().includes(q)) ||
          m.type.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [monitors, live, activeTab, searchQuery]);

  // --- 1. UNAUTHENTICATED LANDING SCREEN (UPTIMEROBOT THEME) ---
  if (!currentUser) {
    return (
      <main className="wrap">
        {/* Minimal Navigation Bar */}
        <header className="topbar">
          <div className="brand-badge">
            <span className="brand-robot">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2a2 2 0 0 1 2 2v1h1a3 3 0 0 1 3 3v2h1a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-1v4a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3v-4H5a2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2h1V8a3 3 0 0 1 3-3h1V4a2 2 0 0 1 2-2zM9 10a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm6 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm-6 6h6v-1.5H9V16z" />
              </svg>
            </span>
            <span>UptimeMonk</span>
          </div>

          <div className="row">
            <span className="status-pill up" style={{ fontSize: "0.72rem" }}>
              <span className="status-dot up" />
              Probes Live
            </span>
            <button className="primary" onClick={handleGoogleSignIn} disabled={isSigningIn}>
              {isSigningIn ? "Connecting…" : "Sign In with Google"}
            </button>
          </div>
        </header>

        {/* Lightweight Hero */}
        <section className="hero-wrap">
          <div className="hero-tag">
            <span className="status-dot up" />
            Free Website &amp; Infrastructure Monitoring
          </div>
          <h1 className="hero-title">
            Keep your websites &amp; APIs online.
          </h1>
          <p className="hero-desc">
            Continuous HTTP, SSL, ping, and cron heartbeat monitoring with sub-minute checks and instant alerts before your users notice.
          </p>

          {/* Direct CTA */}
          <div className="hero-cta-wrap">
            {authError && (
              <div
                style={{
                  background: "rgba(239, 68, 68, 0.12)",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  borderRadius: "8px",
                  padding: "10px 14px",
                  color: "#ef4444",
                  fontSize: "0.85rem",
                  maxWidth: "400px",
                  textAlign: "center",
                }}
              >
                {authError}
              </div>
            )}

            <button className="google-btn-light" onClick={handleGoogleSignIn} disabled={isSigningIn}>
              {isSigningIn ? (
                <span>Connecting to Google…</span>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                    />
                  </svg>
                  <span>Continue with Google</span>
                </>
              )}
            </button>
            <p className="dim" style={{ fontSize: "0.78rem" }}>
              50 monitors free · No credit card required · Instant setup
            </p>
          </div>

          {/* Horizontal Feature Badges */}
          <div className="features-strip">
            <div className="feature-pill">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3BD671" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10 15 15 0 0 1 4-10z" />
              </svg>
              <span>Website &amp; API (HTTP)</span>
            </div>
            <div className="feature-pill">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3BD671" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
              </svg>
              <span>SSL Expiry Alerts</span>
            </div>
            <div className="feature-pill">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3BD671" strokeWidth="2">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
              <span>Ping (ICMP)</span>
            </div>
            <div className="feature-pill">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3BD671" strokeWidth="2">
                <rect width="18" height="18" x="3" y="3" rx="2" />
              </svg>
              <span>Port &amp; DNS Checks</span>
            </div>
            <div className="feature-pill">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3BD671" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span>Cron Heartbeats</span>
            </div>
            <div className="feature-pill">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3BD671" strokeWidth="2">
                <rect width="18" height="18" x="3" y="3" rx="2" />
                <path d="M7 8h10" />
                <path d="M7 12h10" />
              </svg>
              <span>Public Status Pages</span>
            </div>
          </div>

          {/* Compact Live Check Preview */}
          <div className="preview-box">
            <div className="preview-topbar">
              <div className="preview-dots">
                <span className="preview-dot-mac" />
                <span className="preview-dot-mac" />
                <span className="preview-dot-mac" />
              </div>
              <span>Live Edge Probes — Active Checks</span>
              <span className="status-dot up" />
            </div>
            <div className="preview-rows">
              <div className="preview-row">
                <div className="row">
                  <span className="status-dot up" />
                  <span className="preview-target">https://api.example.com/health</span>
                </div>
                <div className="row">
                  <span className="dim">200 OK</span>
                  <span className="latency-val latency-fast">28 ms</span>
                </div>
              </div>
              <div className="preview-row">
                <div className="row">
                  <span className="status-dot up" />
                  <span className="preview-target">https://example.com</span>
                </div>
                <div className="row">
                  <span className="dim">SSL Valid (82d)</span>
                  <span className="latency-val latency-fast">44 ms</span>
                </div>
              </div>
              <div className="preview-row">
                <div className="row">
                  <span className="status-dot up" />
                  <span className="preview-target">db.internal:5432</span>
                </div>
                <div className="row">
                  <span className="dim">TCP Open</span>
                  <span className="latency-val latency-fast">12 ms</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Minimal Footer */}
        <footer className="app-footer">
          <span>UptimeMonk · Lightweight Infrastructure Monitoring</span>
          <span>v{process.env.NEXT_PUBLIC_APP_VERSION ?? "0.1.0"}</span>
        </footer>
      </main>
    );
  }

  // --- 2. AUTHENTICATED DASHBOARD (UPTIMEROBOT THEME) ---
  return (
    <main className="wrap">
      {/* Top Navbar */}
      <header className="topbar">
        <div className="brand-badge">
          <span className="brand-robot">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2a2 2 0 0 1 2 2v1h1a3 3 0 0 1 3 3v2h1a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-1v4a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3v-4H5a2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2h1V8a3 3 0 0 1 3-3h1V4a2 2 0 0 1 2-2zM9 10a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm6 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm-6 6h6v-1.5H9V16z" />
            </svg>
          </span>
          <span>UptimeMonk</span>
          <span className="workspace-pill">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 7h-9" />
              <path d="M14 17H5" />
              <circle cx="17" cy="17" r="3" />
              <circle cx="7" cy="7" r="3" />
            </svg>
            Default Workspace
          </span>
        </div>

        <div className="row">
          {currentUser.email && (
            <span className="dim" style={{ fontSize: "0.8rem", maxWidth: "180px", overflow: "hidden", textOverflow: "ellipsis" }}>
              {currentUser.email}
            </span>
          )}
          <button className="btn-sm" onClick={() => signOut(auth)} title="Sign out">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" x2="9" y1="12" y2="12" />
            </svg>
            Sign out
          </button>
        </div>
      </header>

      {/* Top Stats Bar */}
      <section className="stats-bar">
        <div className="stat-box">
          <div className="stat-title">
            <span>Overall Uptime</span>
            <span style={{ color: "#3BD671" }}>30 DAYS</span>
          </div>
          <div className="stat-num" style={{ color: "#3BD671" }}>
            {stats.avgUptime}%
          </div>
          <div className="dim">System-wide operational ratio</div>
        </div>

        <div className="stat-box">
          <div className="stat-title">
            <span>Up Monitors</span>
            <span className="status-dot up" />
          </div>
          <div className="stat-num" style={{ color: "#3BD671" }}>
            {stats.upCount}
          </div>
          <div className="dim">Reporting healthy response</div>
        </div>

        <div className="stat-box">
          <div className="stat-title">
            <span>Down Monitors</span>
            <span className={`status-dot ${stats.downCount > 0 ? "down" : "pending"}`} />
          </div>
          <div className="stat-num" style={{ color: stats.downCount > 0 ? "#ef4444" : "inherit" }}>
            {stats.downCount}
          </div>
          <div className="dim">{stats.downCount > 0 ? "Active incidents" : "No downtime detected"}</div>
        </div>

        <div className="stat-box">
          <div className="stat-title">
            <span>Avg Response</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 14 14" />
            </svg>
          </div>
          <div className="stat-num">
            {stats.avgLatency != null ? `${stats.avgLatency} ms` : "—"}
          </div>
          <div className="dim">Fast global edge probes</div>
        </div>
      </section>

      {/* Global Error Callout */}
      {error && (
        <div
          style={{
            background: "rgba(239, 68, 68, 0.12)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            borderRadius: "8px",
            padding: "10px 16px",
            color: "#ef4444",
            marginBottom: "16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
          role="alert"
        >
          <span>{error}</span>
          <button className="btn-sm btn-outline-red" onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {/* Filter Row: Tabs + Search + Add Monitor Button */}
      <div className="filter-row">
        <div className="tabs-group">
          <button
            className={`tab-btn ${activeTab === "all" ? "active" : ""}`}
            onClick={() => setActiveTab("all")}
          >
            <span>All</span>
            <span className="badge-count">{monitors.length}</span>
          </button>
          <button
            className={`tab-btn ${activeTab === "up" ? "active" : ""}`}
            onClick={() => setActiveTab("up")}
          >
            <span>Up</span>
            <span className="badge-count up">{stats.upCount}</span>
          </button>
          <button
            className={`tab-btn ${activeTab === "down" ? "active" : ""}`}
            onClick={() => setActiveTab("down")}
          >
            <span>Down</span>
            <span className="badge-count down">{stats.downCount}</span>
          </button>
          <button
            className={`tab-btn ${activeTab === "paused" ? "active" : ""}`}
            onClick={() => setActiveTab("paused")}
          >
            <span>Paused</span>
            <span className="badge-count">{stats.pausedCount}</span>
          </button>
        </div>

        <div className="row grow" style={{ justifyContent: "flex-end" }}>
          <div className="search-box">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              placeholder="Search monitors…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <button className="primary" onClick={() => setIsCreateModalOpen(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            + Add New Monitor
          </button>
        </div>
      </div>

      {/* Monitor Cards List */}
      <div className="monitor-list">
        {filteredMonitors.map((m) => {
          const status = statusOf(m);
          const state = live[m.id];
          const isPaused = m.enabled === false;
          const latency = state?.lastResponseTimeMs;
          const latencyClass =
            latency == null
              ? ""
              : latency < 250
              ? "latency-fast"
              : latency < 600
              ? "latency-med"
              : "latency-slow";

          const intervalText =
            m.intervalSeconds != null
              ? m.intervalSeconds >= 3600
                ? `${Math.round(m.intervalSeconds / 3600)} hr`
                : `${Math.round(m.intervalSeconds / 60)} min`
              : "5 min";

          return (
            <div key={m.id} className="monitor-card">
              {/* Status Pill (UP / DOWN / PAUSED) */}
              <span className={`status-pill ${state?.inMaintenance ? "maintenance" : status}`}>
                <span className="status-dot-container">
                  {status === "up" && <span className="pulse-ring up" />}
                  {status === "down" && <span className="pulse-ring down" />}
                  <span className={`status-dot ${state?.inMaintenance ? "maintenance" : status}`} />
                </span>
                {state?.inMaintenance ? "MAINT" : status}
              </span>

              {/* Protocol Icon */}
              <div className="monitor-type-badge">
                <MonitorTypeIcon type={m.type} size={18} />
              </div>

              {/* Monitor Info */}
              <div className="grow">
                <div className="monitor-name">
                  <span>{m.name}</span>
                  <span className="interval-tag">{intervalText}</span>
                </div>
                <div className="monitor-target">
                  {m.target ? (
                    <a
                      href={m.target.startsWith("http") ? m.target : `http://${m.target}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {m.target} ↗
                    </a>
                  ) : (
                    <span>{m.type}</span>
                  )}
                </div>
              </div>

              {/* Response Time & 30d Uptime */}
              <div style={{ textAlign: "right", minWidth: "120px" }}>
                <div className={`latency-val ${latencyClass}`}>
                  {latency != null ? `${latency} ms` : "—"}
                </div>
                <div className="dim">
                  {state?.uptime30d != null ? `${state.uptime30d.toFixed(2)}% / 30d` : "measuring…"}
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <button
                  className="btn-sm"
                  onClick={() => togglePause(m)}
                  disabled={busyId === m.id}
                  title={isPaused ? "Resume" : "Pause"}
                >
                  {busyId === m.id ? (
                    "Updating…"
                  ) : isPaused ? (
                    <>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="5 3 19 12 5 21 5 3" />
                      </svg>
                      Resume
                    </>
                  ) : (
                    <>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                        <rect x="6" y="4" width="4" height="16" />
                        <rect x="14" y="4" width="4" height="16" />
                      </svg>
                      Pause
                    </>
                  )}
                </button>

                <button
                  className="btn-sm"
                  onClick={() => handleDelete(m)}
                  disabled={busyId === m.id}
                  title="Delete monitor"
                  style={{
                    padding: "6px 8px",
                    color: "#f43f5e",
                    borderColor: "rgba(244, 63, 94, 0.2)",
                  }}
                  aria-label="Delete monitor"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              </div>
            </div>
          );
        })}

        {/* Empty State */}
        {!filteredMonitors.length && (
          <div className="empty-state">
            <div className="empty-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2a2 2 0 0 1 2 2v1h1a3 3 0 0 1 3 3v2h1a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-1v4a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3v-4H5a2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2h1V8a3 3 0 0 1 3-3h1V4a2 2 0 0 1 2-2zM9 10a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm6 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm-6 6h6v-1.5H9V16z" />
              </svg>
            </div>
            <h3 style={{ fontWeight: 700, fontSize: "1.15rem" }}>
              {searchQuery ? "No monitors match your search" : "You don't have any monitors yet"}
            </h3>
            <p className="muted" style={{ maxWidth: "440px", margin: "8px auto 20px" }}>
              {searchQuery
                ? "Try searching for a different name, host, or clear your active filter tab."
                : "Create your first monitor to start checking uptime, HTTP response codes, SSL certificates, and ping latency."}
            </p>
            {searchQuery ? (
              <button onClick={() => { setSearchQuery(""); setActiveTab("all"); }}>
                Clear Search
              </button>
            ) : (
              <button className="primary" onClick={() => setIsCreateModalOpen(true)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                + Add New Monitor
              </button>
            )}
          </div>
        )}
      </div>

      {/* Add New Monitor Modal */}
      <NewMonitorForm
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreated={() => setIsCreateModalOpen(false)}
      />

      {/* Footer */}
      <footer className="app-footer">
        <span>UptimeMonk · Free Website &amp; Infrastructure Monitoring</span>
        <span>v{process.env.NEXT_PUBLIC_APP_VERSION ?? "0.1.0"}</span>
      </footer>
    </main>
  );
}
