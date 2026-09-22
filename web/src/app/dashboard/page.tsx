"use client";

import { useEffect, useState, useMemo } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { needsEmailConfirmation } from "@/lib/authProviders";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { api, ApiError, checksPerDay, type Billing } from "@/lib/api";
import AlertContacts from "./AlertContacts";
import Support from "./Support";
import OrgSettings from "./OrgSettings";
import { recaptchaToken } from "@/lib/recaptcha";
import NewMonitorForm, {
  MonitorTypeIcon,
  protocolTag,
  type MonitorType,
} from "./NewMonitorForm";
import MonitorDetail, { fmtDuration } from "./MonitorDetail";
import Landing from "@/components/Landing";
import VerifyEmailGate from "@/components/VerifyEmailGate";
import ProfileModal from "@/components/ProfileModal";
import LanguagePicker from "@/components/LanguagePicker";
import type { FeedIncident } from "@/lib/api";
import { useI18n } from "@/lib/i18n/context";
import type { Translations } from "@/lib/i18n/translations";
import { events, identify } from "@/lib/analytics";

type Status = "up" | "down" | "pending" | "paused";

interface MonitorConfig {
  id: string;
  name: string;
  target: string;
  type: MonitorType | string;
  intervalSeconds?: number;
  enabled?: boolean;
  // Needed so the edit form opens pre-filled rather than blank.
  port?: number;
  keyword?: string;
  publicOnStatusPage?: boolean;
  muteAlerts?: boolean;
  alertContactIds?: string[];
  heartbeatToken?: string;
  heartbeatGraceSeconds?: number;
}

interface LiveState {
  status: Status;
  inMaintenance?: boolean;
  lastResponseTimeMs?: number | null;
  lastError?: string | null;
  uptime30d?: number | null;
  certExpiresAt?: number | null;
  /** The mirror has always sent this; the card never showed it. */
  lastCheckedAt?: number | null;
}

/**
 * "3s ago" rather than a timestamp: on a monitoring list the only thing that
 * matters is whether the last check was recent, and a clock face makes you do
 * the subtraction yourself.
 */
function sinceLabel(t: (key: keyof Translations) => string, at?: number | null, locale?: string): string {
  if (!at) return t("dashNeverChecked");
  const secs = Math.max(0, Math.round((Date.now() - at) / 1000));
  if (locale === "zh") {
    if (secs < 60) return `${secs}秒前`;
    if (secs < 3600) return `${Math.round(secs / 60)}分钟前`;
    if (secs < 86400) return `${Math.round(secs / 3600)}小时前`;
    return `${Math.round(secs / 86400)}天前`;
  }
  if (locale === "ja") {
    if (secs < 60) return `${secs}秒前`;
    if (secs < 3600) return `${Math.round(secs / 60)}分前`;
    if (secs < 86400) return `${Math.round(secs / 3600)}時間前`;
    return `${Math.round(secs / 86400)}日前`;
  }
  if (locale === "ko") {
    if (secs < 60) return `${secs}초 전`;
    if (secs < 3600) return `${Math.round(secs / 60)}분 전`;
    if (secs < 86400) return `${Math.round(secs / 3600)}시간 전`;
    return `${Math.round(secs / 86400)}일 전`;
  }
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.round(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.round(secs / 3600)}h ago`;
  return `${Math.round(secs / 86400)}d ago`;
}

/**
 * How long a certificate has left, and how alarmed to be about it.
 *
 * Thresholds match the default alert days so the badge turns amber at the
 * same moment the first warning is sent — a list that still looks calm while
 * an email says otherwise is worse than no badge.
 */
function certBadge(t: (key: keyof Translations) => string, expiresAt: number): { text: string; state: "ok" | "warn" | "down" } {
  const days = Math.floor((expiresAt - Date.now()) / 86_400_000);
  if (days < 0) return { text: t("dashCertExpired"), state: "down" };
  if (days === 0) return { text: t("dashCertExpiresToday"), state: "down" };
  if (days === 1) return { text: t("dashCertExpiresTomorrow"), state: "down" };
  return {
    text: t("dashCertDays").replace("{days}", String(days)),
    state: days <= 7 ? "down" : days <= 30 ? "warn" : "ok",
  };
}

/** Big numbers, short. "8.97M checks left" reads; "8,970,000" fills the bar. */
function compactChecks(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 2)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}

export default function Dashboard() {
  const { t, locale } = useI18n();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  /** From the ID token; `undefined` until it resolves. See `needsEmailConfirmation`. */
  const [signInProvider, setSignInProvider] = useState<string | null | undefined>(undefined);
  const [userDisplayName, setUserDisplayName] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [monitors, setMonitors] = useState<MonitorConfig[]>([]);
  const [live, setLive] = useState<Record<string, LiveState>>({});
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newInitialType, setNewInitialType] = useState<MonitorType>("http");
  const [newInitialTarget, setNewInitialTarget] = useState("");
  const [editing, setEditing] = useState<MonitorConfig | null>(null);
  const publicCount = monitors.filter((m) => m.publicOnStatusPage).length;
  const [contactsOpen, setContactsOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [workspaceName, setWorkspaceName] = useState<string | null>(null);
  const [copiedTokenId, setCopiedTokenId] = useState<string | null>(null);

  const copyHeartbeatUrl = (id: string, token: string) => {
    const url = `https://api.uptimemonke.com/heartbeat/${token}`;
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(url);
    }
    setCopiedTokenId(id);
    setTimeout(() => setCopiedTokenId((curr) => (curr === id ? null : curr)), 2500);
  };

  const [billing, setBilling] = useState<Billing | null>(null);

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    api
      .org()
      .then((o) => !cancelled && setWorkspaceName(o.name))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    // Non-fatal: the header simply omits the balance if this fails. A billing
    // hiccup must never stop the monitor list rendering.
    api
      .billing()
      .then((b) => !cancelled && setBilling(b))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  /**
   * The workspace incident feed.
   *
   * Polled rather than subscribed: incidents live in the worker's SQLite, not
   * Firestore, so there is nothing to listen to — and that is deliberate, it
   * is what keeps per-check history off the Firestore bill. A minute is well
   * inside the window that matters, since an open incident is already on the
   * monitor card in real time; this list is for the shape of the outage, not
   * the first alarm.
   */
  useEffect(() => {
    if (!orgId) return;
    let live = true;

    const load = async () => {
      try {
        const res = await api.incidents(50);
        if (live) setIncidents(res.incidents);
      } catch {
        // A failed poll leaves the last good list up. An incident panel that
        // empties itself on a blip is worse than one that is a minute stale.
      }
    };

    void load();
    const timer = setInterval(load, 60_000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [orgId]);

  // Arriving from the landing page's donate or hero quick-start button
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("donate") === "1") {
      setSupportOpen(true);
    }
    const newTarget = params.get("new");
    const newType = params.get("type") as MonitorType | null;
    if (newTarget || newType) {
      if (newTarget) setNewInitialTarget(decodeURIComponent(newTarget));
      if (newType) setNewInitialType(newType);
      setIsCreateModalOpen(true);
    }
    if (params.get("donate") || params.get("new") || params.get("type")) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);
  // What this workspace's monitors cost per day, mirroring the server's sum.
  const usedChecksPerDay = monitors
    .filter((m) => m.enabled !== false)
    .reduce((sum, m) => sum + checksPerDay(m.intervalSeconds ?? 60), 0);
  const [detailId, setDetailId] = useState<string | null>(null);
  /** Workspace-wide incident feed — see `api.incidents`. */
  const [incidents, setIncidents] = useState<FeedIncident[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "up" | "down" | "paused" | "pending">("all");

  useEffect(
    () =>
      onAuthStateChanged(auth, async (u) => {
        setCurrentUser(u);
        setUserDisplayName(u?.displayName ?? null);
        if (!u) {
          setSignInProvider(undefined);
          return setOrgId(null);
        }

        let token = await u.getIdTokenResult();
        setSignInProvider(token.signInProvider);
        let id = (token.claims.orgId as string) ?? null;

        if (!id) {
          // Force refresh token to pick up newly assigned claims from backend or bootstrap
          token = await u.getIdTokenResult(true);
          id = (token.claims.orgId as string) ?? null;
        }

        if (!id) {
          try {
            // Minted here rather than at sign-in: this is the call the
            // worker actually gates, and a token is only valid briefly.
            const captcha = await recaptchaToken("signup");
            const { orgId: created } = await api.bootstrap(captcha);
            void events.signUpBootstrapped();
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
        if (id) void identify(id);
      }),
    []
  );

  // Keyboard shortcut: '/' focuses the search box unless already inside an input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault();
        const searchInput = document.getElementById("dashboard-search-input");
        searchInput?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

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
      await api.togglePause(m.id);
      void events.monitorPaused(m.enabled !== false);
    } catch (err) {
      void events.actionFailed("toggle_pause", err instanceof ApiError ? err.status : undefined);
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
      void events.monitorDeleted(String(m.type));
    } catch (err) {
      void events.actionFailed("delete_monitor", err instanceof ApiError ? err.status : undefined);
      setError(err instanceof ApiError ? err.message : "Could not delete that monitor.");
    } finally {
      setBusyId(null);
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
    let pendingCount = 0;
    let totalLatency = 0;
    let latencyCount = 0;
    let totalUptime = 0;
    let uptimeCount = 0;

    monitors.forEach((m) => {
      const s = statusOf(m);
      if (s === "up") upCount++;
      else if (s === "down") downCount++;
      else if (s === "paused") pausedCount++;
      else if (s === "pending") pendingCount++;

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

    return { total, upCount, downCount, pausedCount, pendingCount, avgLatency, avgUptime };
  }, [monitors, live]);

  // Filtered list
  const filteredMonitors = useMemo(() => {
    return monitors.filter((m) => {
      const s = statusOf(m);
      if (activeTab !== "all" && s !== activeTab) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const isHeartbeat = m.type === "heartbeat";
        const matchesCron = isHeartbeat && ("cron".includes(q) || "heartbeat".includes(q));
        return (
          m.name.toLowerCase().includes(q) ||
          (m.target && m.target.toLowerCase().includes(q)) ||
          m.type.toLowerCase().includes(q) ||
          matchesCron
        );
      }
      return true;
    });
  }, [monitors, live, activeTab, searchQuery]);

  // --- 1. UNAUTHENTICATED LANDING SCREEN (UPTIMEROBOT THEME) ---
  // Signed out: send them to the public page, which is where the marketing
  // copy lives and the only page meant to be indexed.
  if (!currentUser) {
    return (
      <main className="wrap">
        <Landing onSignedIn={(u) => u && setCurrentUser(u)} />
      </main>
    );
  }


  /**
   * Signed in, but the address is not confirmed.
   *
   * The API refuses these tokens outright, so without this the dashboard
   * would render and then fail every request with nothing explaining why.
   * A federated sign-in never lands here — the provider asserts the address,
   * and there is no confirmation link such a user could click. See
   * `needsEmailConfirmation`, which mirrors the server's own rule.
   */
  if (needsEmailConfirmation(currentUser, signInProvider)) {
    return <VerifyEmailGate user={currentUser} />;
  }

  // --- 2. AUTHENTICATED DASHBOARD (UPTIMEROBOT THEME) ---
  return (
    <main className="wrap">
      {/* Top Navbar */}
      <header className="topbar">
        <div className="brand-badge">
          <span className="brand-robot">
              {/* The mascot, not an inline glyph — a brand mark should be
                  the brand mark. 128px source for retina at 20-28px. */}
              <img src="/mascot-128.png" alt="UptimeMonke" width={56} height={56} />
            </span>
          <span>UptimeMonke</span>
          <button
            className="workspace-pill"
            onClick={() => setSettingsOpen(true)}
            title="Rename the workspace, or set the status page address"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 7h-9" />
              <path d="M14 17H5" />
              <circle cx="17" cy="17" r="3" />
              <circle cx="7" cy="7" r="3" />
            </svg>
            {workspaceName ?? t("dashWorkspace")}
          </button>
        </div>

        <div className="row" style={{ gap: "10px" }}>
          {/* User Profile Chip (Avatar + Name + Edit hint + Credit count) */}
          <button
            type="button"
            className="user-profile-chip"
            onClick={() => setProfileOpen(true)}
            title={t("profileTitle")}
            aria-label="Account and profile settings"
          >
            <div className="user-avatar-small">
              {currentUser.photoURL ? (
                <img src={currentUser.photoURL} alt="" />
              ) : (
                <span>
                  {(userDisplayName || currentUser.displayName || currentUser.email || "U")
                    .charAt(0)
                    .toUpperCase()}
                </span>
              )}
            </div>
            <div className="who">
              <span className="who-name">
                {userDisplayName || currentUser.displayName || currentUser.email?.split("@")[0] || t("dashSignedIn")}
              </span>
              <span className="who-edit-hint">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                {t("dashEditUsername")}
              </span>
              {!!billing?.credits && (
                <span className="who-credit" title="Donated capacity remaining">
                  {compactChecks(billing.credits)} {t("dashChecksLeft")}
                </span>
              )}
            </div>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="user-chevron">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          <LanguagePicker compact />

          <button
            className="coffee-btn coffee-btn-nav"
            onClick={() => setSupportOpen(true)}
            title="Capacity used, and how to add more"
          >
            <span aria-hidden>☕</span>
            {t("dashBuyCoffee")}
          </button>
          <button
            className="btn-sm"
            onClick={() => setContactsOpen(true)}
            title="Choose who gets paged when a monitor goes down"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {t("dashAlerts")}
          </button>
          <button className="btn-sm" onClick={() => signOut(auth)} title="Sign out">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" x2="9" y1="12" y2="12" />
            </svg>
            {t("dashSignOut")}
          </button>
        </div>
      </header>

      {/* Top Stats Bar */}
      <section className="stats-bar">
        <div className="stat-box">
          <div className="stat-title">
            <span>{t("dashOverallUptime")}</span>
            <span style={{ color: "#6fc3df" }}>30 DAYS</span>
          </div>
          <div className="stat-num" style={{ color: "#6fc3df" }}>
            {stats.avgUptime}%
          </div>
          <div className="dim">System-wide operational ratio</div>
        </div>

        <div className="stat-box">
          <div className="stat-title">
            <span>{t("dashUpMonitors")}</span>
            <span className="status-dot up" />
          </div>
          <div className="stat-num" style={{ color: "#6fc3df" }}>
            {stats.upCount}
          </div>
          <div className="dim">Reporting healthy response</div>
        </div>

        <div className="stat-box">
          <div className="stat-title">
            <span>{t("dashDownMonitors")}</span>
            <span className={`status-dot ${stats.downCount > 0 ? "down" : "pending"}`} />
          </div>
          <div className="stat-num" style={{ color: stats.downCount > 0 ? "#ef4444" : "inherit" }}>
            {stats.downCount}
          </div>
          <div className="dim">{stats.downCount > 0 ? `${stats.downCount} ${t("dashIncidentsActive")}` : t("dashAllOperational")}</div>
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
            <span>{t("dashFilterAll")}</span>
            <span className="badge-count">{monitors.length}</span>
          </button>
          <button
            className={`tab-btn ${activeTab === "up" ? "active" : ""}`}
            onClick={() => setActiveTab("up")}
          >
            <span>{t("dashFilterUp")}</span>
            <span className="badge-count up">{stats.upCount}</span>
          </button>
          <button
            className={`tab-btn ${activeTab === "down" ? "active" : ""}`}
            onClick={() => setActiveTab("down")}
          >
            <span>{t("dashFilterDown")}</span>
            <span className="badge-count down">{stats.downCount}</span>
          </button>
          <button
            className={`tab-btn ${activeTab === "paused" ? "active" : ""}`}
            onClick={() => setActiveTab("paused")}
          >
            <span>{t("dashFilterPaused")}</span>
            <span className="badge-count">{stats.pausedCount}</span>
          </button>
          {stats.pendingCount > 0 && (
            <button
              className={`tab-btn ${activeTab === "pending" ? "active" : ""}`}
              onClick={() => setActiveTab("pending")}
            >
              <span>Pending</span>
              <span className="badge-count" style={{ background: "rgba(234, 179, 8, 0.2)", color: "#eab308" }}>{stats.pendingCount}</span>
            </button>
          )}
        </div>

        <div className="row grow" style={{ justifyContent: "flex-end" }}>
          <div className="search-box">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              id="dashboard-search-input"
              placeholder={t("dashSearchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery ? (
              <button
                type="button"
                className="search-clear-btn"
                onClick={() => setSearchQuery("")}
                aria-label="Clear search"
                title="Clear search"
              >
                ×
              </button>
            ) : (
              <span className="search-kbd-hint" title="Press / to search">/</span>
            )}
          </div>

          {orgId && (
            <a
              className="btn-status-page"
              href={`/status/${orgId}`}
              target="_blank"
              rel="noopener noreferrer"
              title={
                publicCount > 0
                  ? `${publicCount} of your monitors are on this page`
                  : "Nothing is published yet — tick “Show on public status page” on a monitor"
              }
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="9" />
                <path d="M3 12h18M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18" />
              </svg>
              {t("dashViewStatusPage")}
              {publicCount > 0 && <span className="badge-count">{publicCount}</span>}
            </a>
          )}

          <button className="primary" onClick={() => setIsCreateModalOpen(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            + {t("dashNewMonitor")}
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
            <div
              key={m.id}
              className={`monitor-card ${status === "down" ? "is-down" : ""} ${
                isPaused ? "is-paused" : ""
              }`}
              role="button"
              tabIndex={0}
              aria-label={`${m.name} — view history`}
              onClick={() => {
                setDetailId(m.id);
                void events.historyViewed(String(m.type));
              }}
              onKeyDown={(e) => {
                if (e.key !== "Enter" && e.key !== " ") return;
                e.preventDefault();
                setDetailId(m.id);
                void events.historyViewed(String(m.type));
              }}
            >
              {/* Status Pill (UP / DOWN / PAUSED) */}
              <span className={`status-pill ${state?.inMaintenance ? "maintenance" : status}`}>
                <span className="status-dot-container">
                  {status === "up" && <span className="pulse-ring up" />}
                  {status === "down" && <span className="pulse-ring down" />}
                  <span className={`status-dot ${state?.inMaintenance ? "maintenance" : status}`} />
                </span>
                {state?.inMaintenance ? t("dashMaintenance") : (status === "up" ? t("dashStatusUp") : status === "down" ? t("dashStatusDown") : status === "paused" ? t("dashStatusPaused") : t("dashStatusPending"))}
              </span>

              {/* Protocol Icon */}
              <div className="monitor-type-badge" title={protocolTag(m.type)}>
                <MonitorTypeIcon type={m.type} size={18} />
              </div>

              {/* Monitor Info */}
              <div className="grow">
                <div className="monitor-name">
                  <span>{m.name}</span>
                  {/* The protocol tag stays on the name row — it is what the
                      list is scanned by. Everything else moved down to the
                      subline, because five chips beside a name means the name
                      stops being the thing you see first. */}
                  <span className={`protocol-tag ${m.type}`}>{protocolTag(m.type)}</span>
                </div>
                <div className="monitor-target">
                  {m.type === "heartbeat" && m.heartbeatToken ? (
                    <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginTop: "2px" }}>
                      <span
                        style={{
                          fontFamily: "var(--font-mono, monospace)",
                          fontSize: "0.75rem",
                          background: "rgba(255, 255, 255, 0.05)",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          color: "var(--text-dim)",
                          maxWidth: "260px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={`https://api.uptimemonke.com/heartbeat/${m.heartbeatToken}`}
                      >
                        {`.../heartbeat/${m.heartbeatToken.slice(0, 10)}…`}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          copyHeartbeatUrl(m.id, m.heartbeatToken!);
                        }}
                        style={{
                          background: copiedTokenId === m.id ? "rgba(63, 169, 201, 0.15)" : "rgba(255, 255, 255, 0.08)",
                          border: `1px solid ${copiedTokenId === m.id ? "rgba(63, 169, 201, 0.4)" : "var(--border)"}`,
                          color: copiedTokenId === m.id ? "#3fa9c9" : "var(--text)",
                          borderRadius: "4px",
                          padding: "2px 8px",
                          fontSize: "0.72rem",
                          fontWeight: 500,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          transition: "all 0.15s ease",
                        }}
                        title="Copy Heartbeat ping URL"
                        aria-label="Copy Heartbeat ping URL"
                      >
                        {copiedTokenId === m.id ? (
                          <>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                            <span>{t("dashCopied")}</span>
                          </>
                        ) : (
                          <>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                            <span>{t("dashCopyHeartbeat")}</span>
                          </>
                        )}
                      </button>
                    </div>
                  ) : m.target ? (
                    <a
                      href={m.target.startsWith("http") ? m.target : `http://${m.target}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {m.target} ↗
                    </a>
                  ) : (
                    <span>{m.type === "heartbeat" ? "Heartbeat Push API" : m.type}</span>
                  )}
                </div>

                {/* Secondary facts: present and readable, but quiet. Nothing
                    was removed — it is the weight that changed, so status,
                    name and target carry the scan. */}
                <div className="monitor-marks">
                  <span className="mark">{intervalText}</span>
                  {m.publicOnStatusPage && (
                    <span className="mark" title="Shown on your public status page">
                      public
                    </span>
                  )}
                  {state?.certExpiresAt != null && (() => {
                    const b = certBadge(t, state.certExpiresAt);
                    return (
                      <span
                        /* Expiry keeps its colour when it is close: a quiet
                           mark is still the right weight, an invisible one is
                           not, and a cert about to lapse is actionable. */
                        className={`mark mark-cert ${b.state}`}
                        title={`Certificate valid until ${new Date(
                          state.certExpiresAt
                        ).toLocaleDateString(undefined, {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}`}
                      >
                        {b.text}
                      </span>
                    );
                  })()}
                  {m.muteAlerts && (
                    <span className="mark" title="Incidents are recorded but nobody is paged">
                      muted
                    </span>
                  )}
                </div>
              </div>

              {/* Response Time & 30d Uptime */}
              <div className="monitor-metrics">
                <div className={`latency-val ${latencyClass}`}>
                  {latency != null ? `${latency} ms` : "—"}
                </div>
                <div className="dim">
                  {state?.uptime30d != null ? `${state.uptime30d.toFixed(2)}% / ${t("dashUptime30d")}` : "…"}
                </div>
                {/* "Is this thing even running?" is the first question a
                    monitoring list has to answer, and it was not on the card. */}
                <div
                  className="monitor-checked"
                  title={
                    state?.lastCheckedAt
                      ? `Last checked ${new Date(state.lastCheckedAt).toLocaleString()}`
                      : "No check recorded yet"
                  }
                >
                  {sinceLabel(t, state?.lastCheckedAt, locale)}
                </div>
              </div>

              {/* Action Buttons */}
              <div
                className={`monitor-actions ${busyId === m.id ? "busy" : ""}`}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  className="btn-icon"
                  onClick={() => setEditing(m)}
                  disabled={busyId === m.id}
                  title={t("dashEdit")}
                  aria-label={`Edit ${m.name}`}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>

                <button
                  className="btn-icon"
                  onClick={() => togglePause(m)}
                  disabled={busyId === m.id}
                  title={isPaused ? `${t("dashResume")} ${m.name}` : `${t("dashPause")} ${m.name}`}
                  aria-label={isPaused ? `${t("dashResume")} ${m.name}` : `${t("dashPause")} ${m.name}`}
                >
                  {isPaused ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                  ) : (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                      <rect x="6" y="4" width="4" height="16" />
                      <rect x="14" y="4" width="4" height="16" />
                    </svg>
                  )}
                </button>

                <button
                  className="btn-icon danger"
                  onClick={() => handleDelete(m)}
                  disabled={busyId === m.id}
                  title={`${t("dashDelete")} ${m.name}`}
                  aria-label={`Delete ${m.name}`}
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

        {/* Empty State / Onboarding Guide */}
        {!filteredMonitors.length && (
          <div className="empty-state onboarding-empty-state">
            {searchQuery ? (
              <>
                <div className="empty-icon">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <path d="m9 12 2 2 4-4" />
                  </svg>
                </div>
                <h3 style={{ fontWeight: 700, fontSize: "1.25rem", marginBottom: "8px" }}>
                  {t("dashNoMatchingMonitors")}
                </h3>
                <p className="muted" style={{ maxWidth: "480px", margin: "0 auto 20px", lineHeight: "1.6" }}>
                  {t("dashNoMatchingMonitors")}
                </p>
                <button onClick={() => { setSearchQuery(""); setActiveTab("all"); }}>
                  Clear Search
                </button>
              </>
            ) : (
              <>
                <div className="onboarding-guide-container">
                  <div className="onboarding-guide-header">
                    <div>
                      <h3 style={{ fontWeight: 700, fontSize: "1.2rem", margin: "0 0 4px", color: "var(--text)" }}>
                        {t("onboardTitle")}
                      </h3>
                      <p className="dim" style={{ fontSize: "0.85rem", margin: 0 }}>
                        {t("onboardSubtitle")}
                      </p>
                    </div>
                    <span className="status-pill up" style={{ fontSize: "0.75rem" }}>
                      <span className="status-dot up pulse" />
                      Ready to configure
                    </span>
                  </div>

                  <div className="onboarding-steps-row">
                    <div
                      className="onboarding-step-box"
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        setNewInitialType("http");
                        setNewInitialTarget("");
                        setIsCreateModalOpen(true);
                      }}
                    >
                      <div className="onboarding-step-num">1</div>
                      <div>
                        <strong style={{ fontSize: "0.85rem", display: "block", color: "var(--text)" }}>
                          {t("onboardStep1Title")}
                        </strong>
                        <span className="dim" style={{ fontSize: "0.75rem" }}>
                          {t("onboardStep1Desc")}
                        </span>
                      </div>
                    </div>

                    <div
                      className="onboarding-step-box"
                      role="button"
                      tabIndex={0}
                      onClick={() => setContactsOpen(true)}
                    >
                      <div className="onboarding-step-num">2</div>
                      <div>
                        <strong style={{ fontSize: "0.85rem", display: "block", color: "var(--text)" }}>
                          {t("onboardStep2Title")}
                        </strong>
                        <span className="dim" style={{ fontSize: "0.75rem" }}>
                          {t("onboardStep2Desc")}
                        </span>
                      </div>
                    </div>

                    <div
                      className="onboarding-step-box"
                      role="button"
                      tabIndex={0}
                      onClick={() => setSettingsOpen(true)}
                    >
                      <div className="onboarding-step-num">3</div>
                      <div>
                        <strong style={{ fontSize: "0.85rem", display: "block", color: "var(--text)" }}>
                          {t("onboardStep3Title")}
                        </strong>
                        <span className="dim" style={{ fontSize: "0.75rem" }}>
                          {t("onboardStep3Desc")}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="quickstart-presets-grid">
                  <div
                    className="preset-card"
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setNewInitialType("http");
                      setNewInitialTarget("https://api.myapp.ai/v1/chat/completions");
                      setIsCreateModalOpen(true);
                    }}
                  >
                    <div className="preset-icon ai">
                      <span style={{ fontSize: "1.2rem" }}>🤖</span>
                    </div>
                    <h4>{t("presetAiTitle")}</h4>
                    <p>{t("presetAiDesc")}</p>
                    <span className="preset-action">Monitor AI App →</span>
                  </div>

                  <div
                    className="preset-card"
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setNewInitialType("http");
                      setNewInitialTarget("");
                      setIsCreateModalOpen(true);
                    }}
                  >
                    <div className="preset-icon http">
                      <MonitorTypeIcon type="http" size={24} />
                    </div>
                    <h4>Website (HTTP/S)</h4>
                    <p>Check status codes 2xx/3xx, response time, and keywords.</p>
                    <span className="preset-action">Launch Monitor →</span>
                  </div>

                  <div
                    className="preset-card"
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setNewInitialType("ssl");
                      setNewInitialTarget("");
                      setIsCreateModalOpen(true);
                    }}
                  >
                    <div className="preset-icon ssl">
                      <MonitorTypeIcon type="ssl" size={24} />
                    </div>
                    <h4>SSL Certificate</h4>
                    <p>Automatic alerts before certificates expire (30, 14, 7, 1 days).</p>
                    <span className="preset-action">Track Certificate →</span>
                  </div>

                  <div
                    className="preset-card"
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setNewInitialType("heartbeat");
                      setNewInitialTarget("");
                      setIsCreateModalOpen(true);
                    }}
                  >
                    <div className="preset-icon heartbeat">
                      <MonitorTypeIcon type="heartbeat" size={24} />
                    </div>
                    <h4>Cron Heartbeat</h4>
                    <p>Dead-man's switch for background jobs, backups, or daemons.</p>
                    <span className="preset-action">Create Heartbeat →</span>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Workspace incidents.
          Competitors put this front and centre (UptimeRobot shipped a unified
          incidents tab; Better Stack builds its workflow around the timeline)
          and we had nothing — incidents were reachable one monitor at a time,
          which is the wrong shape for the moment they matter. */}
      {incidents.length > 0 && (
        <section className="incident-feed">
          <div className="incident-feed-head">
            <h2>Incidents</h2>
            <span className="incident-feed-count">
              {incidents.filter((i) => i.status === "open").length > 0
                ? `${incidents.filter((i) => i.status === "open").length} open`
                : "all resolved"}
            </span>
          </div>
          <ul className="incident-feed-list">
            {incidents.slice(0, 12).map((i) => (
              <li key={i.id}>
                <button
                  className="incident-row"
                  onClick={() => setDetailId(i.monitorId)}
                  title={`Open ${i.monitorName}`}
                >
                  <span className={`status-dot ${i.status === "open" ? "down" : "up"}`} />
                  <span className="incident-monitor">{i.monitorName}</span>
                  <span className="incident-cause">{i.cause || "Unavailable"}</span>
                  <span className="incident-when">
                    {i.status === "open"
                      ? `down ${fmtDuration((Date.now() - i.startedAt) / 1000)}`
                      : i.durationSeconds != null
                        ? `${fmtDuration(i.durationSeconds)} outage`
                        : "resolved"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Add New Monitor Modal */}
      <MonitorDetail monitorId={detailId} onClose={() => setDetailId(null)} />

      {/* Same dialog, edit mode. Keyed by id so reopening for a different
          monitor remounts with that monitor's values. */}
      <OrgSettings
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onRenamed={setWorkspaceName}
        onOpenProfile={() => setProfileOpen(true)}
      />

      <ProfileModal
        isOpen={profileOpen}
        onClose={() => setProfileOpen(false)}
        currentUser={currentUser}
        onUpdated={(name) => setUserDisplayName(name)}
        onOpenWorkspaceSettings={() => setSettingsOpen(true)}
      />

      <AlertContacts isOpen={contactsOpen} onClose={() => setContactsOpen(false)} />

      <Support
        isOpen={supportOpen}
        onClose={() => setSupportOpen(false)}
        usedChecksPerDay={usedChecksPerDay}
      />

      <NewMonitorForm
        key={editing?.id ?? "edit"}
        isOpen={!!editing}
        monitor={editing}
        onClose={() => setEditing(null)}
        onCreated={() => setEditing(null)}
      />

      <NewMonitorForm
        isOpen={isCreateModalOpen}
        initialType={newInitialType}
        initialTarget={newInitialTarget}
        onClose={() => {
          setIsCreateModalOpen(false);
          setNewInitialTarget("");
          setNewInitialType("http");
        }}
        onCreated={() => {
          setIsCreateModalOpen(false);
          setNewInitialTarget("");
          setNewInitialType("http");
        }}
      />

      {/* Footer */}
      <footer className="app-footer">
        <span>UptimeMonke · Free Website &amp; Infrastructure Monitoring</span>
        <span className="row" style={{ gap: 14, alignItems: "center" }}>
          <a href="/privacy" className="dim" style={{ textDecoration: "none" }}>
            Privacy
          </a>
          <span>v{process.env.NEXT_PUBLIC_APP_VERSION ?? "0.1.0"}</span>
        </span>
      </footer>
    </main>
  );
}
