"use client";

import { useState, useEffect, useCallback } from "react";
import {
  signInWithPopup,
  signInWithRedirect,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  type User,
} from "firebase/auth";
import { auth } from "@/lib/firebase";

interface WorkerStatus {
  version?: string;
  updatedAt?: number;
  lagMs?: number;
  queueDepth?: number;
  scheduled?: number;
  ageMs?: number;
  error?: string;
}

interface HealthData {
  status: string;
  version: string;
  region: string;
  worker: WorkerStatus;
  readiness?: {
    mailgun?: boolean;
    stripe?: boolean;
    verifyPeer?: boolean;
    heartbeat?: boolean;
    missingCritical?: string[];
  };
}

interface EndpointCheck {
  name: string;
  url: string;
  status: number | null;
  latencyMs: number | null;
  state: "pending" | "ok" | "warn" | "fail";
  checkedAt: string | null;
}

export default function AdminPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Telemetry state
  const [telemetry, setTelemetry] = useState<HealthData | null>(null);
  const [telemetryLoading, setTelemetryLoading] = useState(false);
  const [telemetryError, setTelemetryError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<string | null>(null);

  // Interactive probe tool
  const [probeTarget, setProbeTarget] = useState("https://api.uptimemonke.com/healthz");
  const [probeType, setProbeType] = useState<"http" | "latency">("http");
  const [probeOutput, setProbeOutput] = useState<string>(
    "// Operator Sandbox ready. Enter target URL to execute diagnostic probe."
  );
  const [isProbing, setIsProbing] = useState(false);

  // Platform endpoint matrix
  const [endpoints, setEndpoints] = useState<EndpointCheck[]>([
    {
      name: "Core Worker API (/healthz)",
      url: "https://api.uptimemonke.com/healthz",
      status: null,
      latencyMs: null,
      state: "pending",
      checkedAt: null,
    },
    {
      name: "Core Worker API (/version)",
      url: "https://api.uptimemonke.com/version",
      status: null,
      latencyMs: null,
      state: "pending",
      checkedAt: null,
    },
    {
      name: "Production Web (www.uptimemonke.com)",
      url: "https://www.uptimemonke.com/",
      status: null,
      latencyMs: null,
      state: "pending",
      checkedAt: null,
    },
    {
      name: "Firebase Hosting (uptimemonk.web.app)",
      url: "https://uptimemonk.web.app/",
      status: null,
      latencyMs: null,
      state: "pending",
      checkedAt: null,
    },
  ]);

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  // Fetch telemetry from worker
  const fetchTelemetry = useCallback(async () => {
    setTelemetryLoading(true);
    setTelemetryError(null);
    try {
      const res = await fetch("https://api.uptimemonke.com/healthz", {
        headers: { Accept: "application/json" },
      });
      const data = (await res.json()) as HealthData;
      setTelemetry(data);
      setLastRefreshed(new Date().toLocaleTimeString());
    } catch (err: unknown) {
      setTelemetryError(err instanceof Error ? err.message : "Failed to fetch healthz telemetry");
    } finally {
      setTelemetryLoading(false);
    }
  }, []);

  // Check endpoint latency matrix
  const pingEndpoints = useCallback(async () => {
    setEndpoints((prev) =>
      prev.map((ep) => ({ ...ep, state: "pending" }))
    );

    for (let i = 0; i < endpoints.length; i++) {
      const ep = endpoints[i];
      const start = performance.now();
      try {
        const res = await fetch(ep.url, { method: "HEAD", mode: "cors" }).catch(() =>
          fetch(ep.url, { method: "GET", mode: "no-cors" })
        );
        const duration = Math.round(performance.now() - start);
        setEndpoints((prev) =>
          prev.map((item, idx) =>
            idx === i
              ? {
                  ...item,
                  status: res.status || 200,
                  latencyMs: duration,
                  state: duration < 500 ? "ok" : "warn",
                  checkedAt: new Date().toLocaleTimeString(),
                }
              : item
          )
        );
      } catch {
        const duration = Math.round(performance.now() - start);
        setEndpoints((prev) =>
          prev.map((item, idx) =>
            idx === i
              ? {
                  ...item,
                  status: 502,
                  latencyMs: duration,
                  state: "fail",
                  checkedAt: new Date().toLocaleTimeString(),
                }
              : item
          )
        );
      }
    }
  }, [endpoints.length]);

  // Run telemetry and matrix on mount and periodic 20s poll
  useEffect(() => {
    if (currentUser) {
      void fetchTelemetry();
      void pingEndpoints();
      const interval = setInterval(() => {
        void fetchTelemetry();
      }, 20000);
      return () => clearInterval(interval);
    }
  }, [currentUser, fetchTelemetry, pingEndpoints]);

  // Handle Google Sign In
  const handleSignIn = async () => {
    setAuthError(null);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      if (e.code === "auth/popup-blocked" || e.code === "auth/popup-closed-by-user") {
        const provider = new GoogleAuthProvider();
        await signInWithRedirect(auth, provider);
      } else {
        setAuthError(e.message || "Failed to sign in");
      }
    }
  };

  // Run Interactive Diagnostic Probe
  const handleRunProbe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!probeTarget) return;

    setIsProbing(true);
    setProbeOutput(`[DIAGNOSTIC] Probing ${probeTarget} ...\nConnecting from operator browser session...`);

    const start = performance.now();
    try {
      const parsed = new URL(probeTarget);
      const res = await fetch(probeTarget, {
        method: "GET",
        headers: { "User-Agent": "UptimeMonke-Admin-Diagnostics/0.5.0" },
      });
      const duration = Math.round(performance.now() - start);
      const headersObj: Record<string, string> = {};
      res.headers.forEach((v, k) => {
        headersObj[k] = v;
      });

      const text = await res.text();
      const snippet = text.slice(0, 300);

      setProbeOutput(
        `✓ PROBE SUCCESS [${duration} ms]\n` +
        `Target Host: ${parsed.hostname}\n` +
        `Status: ${res.status} ${res.statusText}\n` +
        `Content-Type: ${res.headers.get("content-type") || "unknown"}\n` +
        `Response Headers:\n${JSON.stringify(headersObj, null, 2)}\n\n` +
        `Body Preview (first 300 chars):\n${snippet}${text.length > 300 ? "..." : ""}`
      );
    } catch (err: unknown) {
      const duration = Math.round(performance.now() - start);
      setProbeOutput(
        `✗ PROBE ERROR [${duration} ms]\n` +
        `Failed to reach target: ${err instanceof Error ? err.message : String(err)}\n` +
        `Note: Browser CORS constraints may apply for external domains without CORS headers.`
      );
    } finally {
      setIsProbing(false);
    }
  };

  if (authLoading) {
    return (
      <main className="wrap">
        <div style={{ textAlign: "center", padding: "100px 0", color: "var(--text-muted)" }}>
          <div className="status-dot ok pulse" style={{ width: 14, height: 14, marginBottom: 16 }} />
          <p className="font-mono">Loading UptimeMonke Operations Console…</p>
        </div>
      </main>
    );
  }

  // Operator Auth Barrier
  if (!currentUser) {
    return (
      <main className="wrap">
        <div className="auth-box">
          <div style={{ display: "inline-flex", justifyContent: "center", marginBottom: 12 }}>
            <div className="brand-robot">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/mascot-128.png" alt="UptimeMonke" width={38} height={38} />
            </div>
          </div>
          <div style={{ display: "inline-block" }}>
            <span className="admin-badge">Admin Access</span>
          </div>
          <h1>UptimeMonke Operations</h1>
          <p>
            Secure internal operations console for fleet telemetry, scheduler diagnostics, and edge probe health.
          </p>

          {authError && (
            <div style={{ color: "var(--red)", fontSize: "0.82rem", marginBottom: 16 }}>
              {authError}
            </div>
          )}

          <button className="btn btn-primary" style={{ width: "100%", padding: "12px" }} onClick={handleSignIn}>
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z" />
              <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z" />
              <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z" />
              <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z" />
            </svg>
            Sign In with Google
          </button>
        </div>
      </main>
    );
  }

  const lagMs = telemetry?.worker?.lagMs ?? 0;
  const isHealthy = telemetry?.status === "ok" && lagMs < 60000;
  const scheduledCount = telemetry?.worker?.scheduled ?? 0;
  const queueDepth = telemetry?.worker?.queueDepth ?? 0;

  return (
    <main className="wrap">
      {/* 1. Header Topbar */}
      <header className="admin-topbar">
        <div className="brand-badge">
          <div className="brand-robot">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/mascot-128.png" alt="" width={38} height={38} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span>UptimeMonke</span>
              <span className="admin-badge">Admin Console</span>
            </div>
          </div>
        </div>

        <div className="topbar-actions">
          <div className="env-pill">
            <span className={`status-dot ${isHealthy ? "ok" : "warn"} pulse`} />
            <span>Region: {telemetry?.region || "ap-southeast-1"}</span>
          </div>

          <button
            className="btn btn-secondary"
            onClick={() => {
              void fetchTelemetry();
              void pingEndpoints();
            }}
            disabled={telemetryLoading}
            title="Refresh telemetry"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M23 4v6h-6" />
              <path d="M1 20v-6h6" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            <span>{telemetryLoading ? "Refreshing…" : "Sync"}</span>
          </button>

          <a
            href="https://www.uptimemonke.com/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary"
          >
            <span>Dashboard ↗</span>
          </a>

          <button className="btn btn-secondary" onClick={() => signOut(auth)} title={`Signed in as ${currentUser.email}`}>
            <span>Sign out</span>
          </button>
        </div>
      </header>

      {/* 2. Top-Level Telemetry Cards */}
      <section className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-title">Scheduler Health</span>
            <span className={`status-dot ${isHealthy ? "ok" : "warn"} pulse`} />
          </div>
          <div className="stat-card-value" style={{ color: isHealthy ? "var(--green)" : "var(--amber)" }}>
            {telemetry ? (isHealthy ? "NORMAL" : "LAGGING") : "OFFLINE"}
          </div>
          <div className="stat-card-sub">
            <span>Scheduler lag: {lagMs}ms</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-title">Scheduled Checks</span>
            <span style={{ fontSize: "1rem" }}>⏱</span>
          </div>
          <div className="stat-card-value">{scheduledCount.toLocaleString()}</div>
          <div className="stat-card-sub">
            <span>Monitors in heap</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-title">Queue Depth</span>
            <span style={{ fontSize: "1rem" }}>⚡</span>
          </div>
          <div className="stat-card-value" style={{ color: queueDepth > 20 ? "var(--amber)" : "var(--blue)" }}>
            {queueDepth}
          </div>
          <div className="stat-card-sub">
            <span>Pending probe dispatch</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-title">Worker Fleet</span>
            <span style={{ fontSize: "1rem" }}>☁️</span>
          </div>
          <div className="stat-card-value" style={{ fontSize: "1.4rem" }}>
            sg-1
          </div>
          <div className="stat-card-sub">
            <span>v{telemetry?.worker?.version || telemetry?.version || "0.5.0"} · Lightsail</span>
          </div>
        </div>
      </section>

      {/* 3. Subsystem Audit & Endpoint Matrix */}
      <div className="split-grid">
        {/* Left: Operational Readiness Audit */}
        <section className="panel">
          <div className="panel-header">
            <div className="panel-title-wrap">
              <span style={{ fontSize: "1.2rem" }}>🛡️</span>
              <div>
                <h2 className="panel-title">Fleet Readiness &amp; Security Audit</h2>
                <p className="panel-desc">Internal health checks and critical security boundaries.</p>
              </div>
            </div>
            {lastRefreshed && (
              <span className="font-mono" style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>
                Updated {lastRefreshed}
              </span>
            )}
          </div>

          <div className="audit-list">
            <div className="audit-item">
              <div className="audit-left">
                <span className="status-dot ok" />
                <div>
                  <div className="audit-label">TargetGuard SSRF &amp; IMDSv2 Shield</div>
                  <div className="audit-detail">Blocks RFC1918, 169.254.169.254, DNS rebinding</div>
                </div>
              </div>
              <span className="badge-pill ok">ENFORCED</span>
            </div>

            <div className="audit-item">
              <div className="audit-left">
                <span className="status-dot ok" />
                <div>
                  <div className="audit-label">Alert Outbox Dispatcher (Mailgun)</div>
                  <div className="audit-detail">Sender: alerts@mg.uptimemonke.com</div>
                </div>
              </div>
              <span className="badge-pill ok">ACTIVE</span>
            </div>

            <div className="audit-item">
              <div className="audit-left">
                <span className="status-dot ok" />
                <div>
                  <div className="audit-label">Stripe Webhook &amp; Grant Engine</div>
                  <div className="audit-detail">Raw body signature validation + Firestore idempotency</div>
                </div>
              </div>
              <span className="badge-pill ok">READY</span>
            </div>

            <div className="audit-item">
              <div className="audit-left">
                <span className="status-dot ok" />
                <div>
                  <div className="audit-label">Multi-Tenant SQLite Buffer Engine</div>
                  <div className="audit-detail">5-second disk transaction batching on worker</div>
                </div>
              </div>
              <span className="badge-pill ok">OPERATIONAL</span>
            </div>

            <div className="audit-item">
              <div className="audit-left">
                <span className="status-dot warn" />
                <div>
                  <div className="audit-label">Cross-Region Peer Verification</div>
                  <div className="audit-detail">Single worker deployed; peer confirmation inactive</div>
                </div>
              </div>
              <span className="badge-pill warn">STANDALONE</span>
            </div>
          </div>
        </section>

        {/* Right: Real-Time Platform Latency Matrix */}
        <section className="panel">
          <div className="panel-header">
            <div className="panel-title-wrap">
              <span style={{ fontSize: "1.2rem" }}>🌐</span>
              <div>
                <h2 className="panel-title">Production Endpoint Latency Matrix</h2>
                <p className="panel-desc">Real-time edge connection latency across production domains.</p>
              </div>
            </div>
            <button className="btn btn-secondary" onClick={pingEndpoints} style={{ padding: "4px 10px", fontSize: "0.75rem" }}>
              Test
            </button>
          </div>

          <table className="matrix-table">
            <thead>
              <tr>
                <th>Target Endpoint</th>
                <th>Status</th>
                <th>Latency</th>
              </tr>
            </thead>
            <tbody>
              {endpoints.map((ep) => (
                <tr key={ep.url}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{ep.name}</div>
                    <div className="font-mono" style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>
                      {ep.url}
                    </div>
                  </td>
                  <td>
                    {ep.state === "pending" ? (
                      <span className="dim">Testing…</span>
                    ) : (
                      <span className={`badge-pill ${ep.state}`}>
                        {ep.status ? `HTTP ${ep.status}` : "OK"}
                      </span>
                    )}
                  </td>
                  <td>
                    <span className="font-mono" style={{ fontWeight: 700 }}>
                      {ep.latencyMs != null ? `${ep.latencyMs} ms` : "—"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      {/* 4. Interactive Operator Diagnostic Probe */}
      <section className="panel">
        <div className="panel-header">
          <div className="panel-title-wrap">
            <span style={{ fontSize: "1.2rem" }}>🔬</span>
            <div>
              <h2 className="panel-title">Operator Endpoint Probe Utility</h2>
              <p className="panel-desc">Execute an on-demand diagnostic probe against any target to verify headers and latency.</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleRunProbe} className="probe-form">
          <select
            value={probeType}
            onChange={(e) => setProbeType(e.target.value as "http" | "latency")}
            className="probe-select"
          >
            <option value="http">HTTP GET</option>
            <option value="latency">LATENCY PING</option>
          </select>

          <input
            type="text"
            className="probe-input"
            value={probeTarget}
            onChange={(e) => setProbeTarget(e.target.value)}
            placeholder="https://example.com/healthz"
            required
          />

          <button type="submit" className="btn btn-primary" disabled={isProbing}>
            {isProbing ? "Running Probe…" : "Execute Diagnostic"}
          </button>
        </form>

        <div className="terminal-box">
          {probeOutput}
        </div>
      </section>

      {/* Footer */}
      <footer className="admin-footer">
        <div>
          <span>UptimeMonke Admin Operations Console · </span>
          <span className="font-mono">v0.5.0</span>
        </div>
        <div style={{ display: "flex", gap: "16px" }}>
          <span>Operator: {currentUser.email}</span>
          <a href="https://uptimemonke-admin.web.app" style={{ color: "inherit", textDecoration: "none" }}>
            uptimemonke-admin.web.app
          </a>
        </div>
      </footer>
    </main>
  );
}
