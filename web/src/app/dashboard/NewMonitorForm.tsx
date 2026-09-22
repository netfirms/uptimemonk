"use client";

import { useState, useEffect } from "react";
import { api, ApiError, type AlertContact } from "@/lib/api";
import { events } from "@/lib/analytics";
import { useI18n } from "@/lib/i18n/context";

export type MonitorType = "http" | "keyword" | "tcp" | "dns" | "ssl" | "icmp" | "heartbeat";

/**
 * The short name for a protocol, for the badge on a monitor card.
 *
 * Separate from the form's `label` on purpose: the form is choosing between
 * options and has room to explain ("Website (HTTP)", "Ping (ICMP)"), while the
 * card is scanned down a list and needs a word that lines up with its
 * neighbours. Keeping both in this file keeps them from drifting apart.
 */
const PROTOCOL_TAGS: Record<MonitorType, string> = {
  http: "HTTP",
  keyword: "KEYWORD",
  ssl: "SSL",
  icmp: "PING",
  tcp: "TCP",
  dns: "DNS",
  heartbeat: "HEARTBEAT",
};

/** Unknown types render their own name rather than vanishing — a monitor
 *  created by a newer build should still be identifiable on an older page. */
export function protocolTag(type: MonitorType | string): string {
  return PROTOCOL_TAGS[type as MonitorType] ?? String(type).toUpperCase();
}

interface TypeOption {
  type: MonitorType;
  label: string;
  hint: string;
  defaultTarget: string;
  desc: string;
}

/** Seconds as something readable — a 5-second floor rendered through a
 *  minutes formatter came out as "0.08 minutes". */
function fmtInterval(seconds: number): string {
  if (seconds < 60) return `${seconds} seconds`;
  if (seconds < 3600) return `${seconds / 60} minute${seconds === 60 ? "" : "s"}`;
  return `${seconds / 3600} hour${seconds === 3600 ? "" : "s"}`;
}

const TYPE_OPTIONS: TypeOption[] = [
  {
    type: "http",
    label: "Website (HTTP)",
    hint: "https://example.com",
    defaultTarget: "https://",
    desc: "Checks status code 2xx/3xx",
  },
  {
    type: "ssl",
    label: "SSL Certificate",
    hint: "example.com",
    defaultTarget: "",
    desc: "Warns before certificate expiry",
  },
  {
    type: "keyword",
    label: "Keyword Check",
    hint: "https://example.com",
    defaultTarget: "https://",
    desc: "Verifies expected text is present",
  },
  {
    type: "icmp",
    label: "Ping (ICMP)",
    hint: "1.1.1.1 or example.com",
    defaultTarget: "",
    desc: "Network latency & packet drop",
  },
  {
    type: "tcp",
    label: "Port (TCP)",
    hint: "example.com",
    defaultTarget: "",
    desc: "Checks connectivity on custom port",
  },
  {
    type: "dns",
    label: "DNS Record",
    hint: "example.com",
    defaultTarget: "",
    desc: "Monitors DNS lookup & resolution",
  },
  {
    type: "heartbeat",
    label: "Cron Heartbeat",
    hint: "No target needed",
    defaultTarget: "",
    desc: "Alerts if cron job fails to ping",
  },
];

export function MonitorTypeIcon({ type, size = 18 }: { type: MonitorType | string; size?: number }) {
  switch (type) {
    case "http":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
          <path d="M2 12h20" />
        </svg>
      );
    case "ssl":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      );
    case "keyword":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
      );
    case "icmp":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
      );
    case "tcp":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect width="20" height="8" x="2" y="2" rx="2" ry="2" />
          <rect width="20" height="8" x="2" y="14" rx="2" ry="2" />
          <line x1="6" x2="6.01" y1="6" y2="6" />
          <line x1="6" x2="6.01" y1="18" y2="18" />
        </svg>
      );
    case "dns":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.9a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
          <path d="m22 12.5-9.42 4.28a2 2 0 0 1-1.66 0L2 12.5" />
          <path d="m22 17.5-9.42 4.28a2 2 0 0 1-1.66 0L2 17.5" />
        </svg>
      );
    case "heartbeat":
    default:
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      );
  }
}

/** The fields the edit form needs to pre-fill. */
export interface EditableMonitor {
  id: string;
  name: string;
  target: string;
  type: MonitorType | string;
  intervalSeconds?: number;
  port?: number;
  keyword?: string;
  keywordRegex?: boolean;
  jsonPath?: string;
  jsonPathExpected?: string;
  maxResponseTimeMs?: number;
  method?: string;
  sslExpiryWarningDays?: number;
  sslExpectedFingerprint?: string;
  sslMinVersion?: string;
  tcpPayload?: string;
  tcpExpectedResponse?: string;
  dnsRecordType?: string;
  dnsExpectedValue?: string;
  dnsServer?: string;
  icmpPacketCount?: number;
  icmpMaxLossPercent?: number;
  publicOnStatusPage?: boolean;
  sslExpiryAlertDays?: number[];
  muteAlerts?: boolean;
  alertContactIds?: string[];
  heartbeatToken?: string;
  heartbeatGraceSeconds?: number;
}

export default function NewMonitorForm({
  isOpen,
  onClose,
  onCreated,
  monitor,
  initialType,
  initialTarget,
}: {
  isOpen?: boolean;
  onClose?: () => void;
  onCreated?: () => void;
  /** Present = edit that monitor. Absent = create a new one. */
  monitor?: EditableMonitor | null;
  initialType?: MonitorType;
  initialTarget?: string;
}) {
  const { t } = useI18n();
  const isEditing = !!monitor;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isOpen !== undefined ? isOpen : internalOpen;
  const [createdHeartbeat, setCreatedHeartbeat] = useState<{ id: string; token: string; name: string } | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedSuccessUrl, setCopiedSuccessUrl] = useState(false);
  const handleClose = () => {
    const wasCreatedHeartbeat = !!createdHeartbeat;
    setCreatedHeartbeat(null);
    if (wasCreatedHeartbeat) {
      setName("");
      setTarget("");
      setKeyword("");
      onCreated?.();
    }
    if (onClose) onClose();
    else setInternalOpen(false);
  };

  const [type, setType] = useState<MonitorType>("http");
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [keyword, setKeyword] = useState("");
  const [port, setPort] = useState("443");
  const [intervalSeconds, setIntervalSeconds] = useState("300");
  const [isPublic, setIsPublic] = useState(false);
  const [muteAlerts, setMuteAlerts] = useState(false);
  /** Highest first, matching the server. Empty means "use the default". */
  const [certAlertDays, setCertAlertDays] = useState<number[]>([30, 14, 7, 1]);
  const [contacts, setContacts] = useState<AlertContact[] | null>(null);
  /** Empty means "everyone verified", which is what the server does too. */
  const [contactIds, setContactIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  // Advanced Options
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [method, setMethod] = useState("GET");
  const [maxResponseTimeMs, setMaxResponseTimeMs] = useState("");
  const [keywordRegex, setKeywordRegex] = useState(false);
  const [jsonPath, setJsonPath] = useState("");
  const [jsonPathExpected, setJsonPathExpected] = useState("");
  const [sslExpiryWarningDays, setSslExpiryWarningDays] = useState("14");
  const [sslExpectedFingerprint, setSslExpectedFingerprint] = useState("");
  const [sslMinVersion, setSslMinVersion] = useState("none");
  const [tcpPayload, setTcpPayload] = useState("");
  const [tcpExpectedResponse, setTcpExpectedResponse] = useState("");
  const [dnsRecordType, setDnsRecordType] = useState("A");
  const [dnsExpectedValue, setDnsExpectedValue] = useState("");
  const [dnsServer, setDnsServer] = useState("");
  const [icmpPacketCount, setIcmpPacketCount] = useState("3");
  const [icmpMaxLossPercent, setIcmpMaxLossPercent] = useState("50");

  // The plan's floor, so the form never offers a value the server would clamp.
  const [minInterval, setMinInterval] = useState(60);
  const [planLabel, setPlanLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load the monitor's current values when the dialog opens, and clear them
  // when it opens for a new monitor instead. Keyed on the id so reopening for
  // a different monitor re-fills rather than showing the previous one.
  useEffect(() => {
    if (!open) return;
    if (monitor) {
      setType((monitor.type as MonitorType) ?? "http");
      setName(monitor.name ?? "");
      setTarget(monitor.target ?? "");
      setKeyword(monitor.keyword ?? "");
      setPort(monitor.port != null ? String(monitor.port) : "443");
      setIntervalSeconds(String(monitor.intervalSeconds ?? 300));
      setIsPublic(monitor.publicOnStatusPage === true);
      setMuteAlerts(monitor.muteAlerts === true);
      setCertAlertDays(monitor.sslExpiryAlertDays ?? [30, 14, 7, 1]);
      setContactIds(monitor.alertContactIds ?? []);

      setMethod(monitor.method ?? (monitor.type === "keyword" ? "GET" : "HEAD"));
      setMaxResponseTimeMs(monitor.maxResponseTimeMs ? String(monitor.maxResponseTimeMs) : "");
      setKeywordRegex(monitor.keywordRegex === true);
      setJsonPath(monitor.jsonPath ?? "");
      setJsonPathExpected(monitor.jsonPathExpected ?? "");
      setSslExpiryWarningDays(String(monitor.sslExpiryWarningDays ?? 14));
      setSslExpectedFingerprint(monitor.sslExpectedFingerprint ?? "");
      setSslMinVersion(monitor.sslMinVersion ?? "none");
      setTcpPayload(monitor.tcpPayload ?? "");
      setTcpExpectedResponse(monitor.tcpExpectedResponse ?? "");
      setDnsRecordType(monitor.dnsRecordType ?? "A");
      setDnsExpectedValue(monitor.dnsExpectedValue ?? "");
      setDnsServer(monitor.dnsServer ?? "");
      setIcmpPacketCount(String(monitor.icmpPacketCount ?? 3));
      setIcmpMaxLossPercent(String(monitor.icmpMaxLossPercent ?? 50));
    } else {
      const defaultT = initialType ?? "http";
      const defaultTarget = initialTarget ?? "";
      setType(defaultT);
      if (defaultTarget) {
        setTarget(defaultTarget);
        try {
          const u = defaultTarget.startsWith("http://") || defaultTarget.startsWith("https://")
            ? new URL(defaultTarget)
            : new URL("https://" + defaultTarget);
          setName(u.hostname || defaultTarget);
        } catch {
          setName(defaultTarget);
        }
      } else {
        setName("");
        setTarget("");
      }
      setKeyword("");
      setPort("443");
      setIntervalSeconds("300");
      // A new monitor is private until someone says otherwise.
      setIsPublic(false);
      setMuteAlerts(false);
      setContactIds([]);
      setCertAlertDays([30, 14, 7, 1]);

      setMethod("GET");
      setMaxResponseTimeMs("");
      setKeywordRegex(false);
      setJsonPath("");
      setJsonPathExpected("");
      setSslExpiryWarningDays("14");
      setSslExpectedFingerprint("");
      setSslMinVersion("none");
      setTcpPayload("");
      setTcpExpectedResponse("");
      setDnsRecordType("A");
      setDnsExpectedValue("");
      setDnsServer("");
      setIcmpPacketCount("3");
      setIcmpMaxLossPercent("50");
      setShowAdvanced(false);
    }
    setError(null);
  }, [open, monitor?.id, initialType, initialTarget]);

  // Fetch the plan floor when the dialog opens. Previously the form offered a
  // 1-minute interval to a free account, the server clamped it to the plan
  // minimum, and the saved value came back different from the one picked —
  // which looks exactly like "the frequency won't update".
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    api
      .me()
      .then((me) => {
        if (cancelled) return;
        setMinInterval(me.limits?.minIntervalSeconds ?? 60);
        setPlanLabel(me.limits?.label ?? null);
      })
      .catch(() => {
        // Non-fatal: leave every option enabled and let the server decide.
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const selectedOption = TYPE_OPTIONS.find((o) => o.type === type) || TYPE_OPTIONS[0];
  const needsTarget = type !== "heartbeat";
  const needsPort = type === "tcp";
  const needsKeyword = type === "keyword";

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    api
      .contacts()
      .then((r) => !cancelled && setContacts(r.contacts))
      // Non-fatal: the picker falls back to "alert everyone", which is the
      // default anyway, so a failed load must not block saving a monitor.
      .catch(() => !cancelled && setContacts([]));
    return () => {
      cancelled = true;
    };
  }, [open]);

  const verified = (contacts ?? []).filter((c) => c.verified && c.enabled);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const payload: Record<string, unknown> = {
      type,
      name: name || target || selectedOption.label,
      target,
      intervalSeconds: Number(intervalSeconds),
      publicOnStatusPage: isPublic,
      muteAlerts,
      alertContactIds: contactIds,
      ...(type === "ssl" ? { sslExpiryAlertDays: certAlertDays } : {}),
      ...(needsKeyword ? { keyword } : {}),
      ...(needsPort ? { port: Number(port) } : {}),
      ...(maxResponseTimeMs ? { maxResponseTimeMs: Number(maxResponseTimeMs) } : {}),
      ...(type === "http" || type === "keyword" ? { method } : {}),
      ...(type === "keyword"
        ? {
            keywordRegex,
            ...(jsonPath ? { jsonPath } : {}),
            ...(jsonPathExpected ? { jsonPathExpected } : {}),
          }
        : {}),
      ...(type === "ssl"
        ? {
            sslExpiryWarningDays: Number(sslExpiryWarningDays) || 14,
            ...(sslExpectedFingerprint ? { sslExpectedFingerprint } : {}),
            ...(sslMinVersion !== "none" ? { sslMinVersion } : {}),
          }
        : {}),
      ...(type === "tcp"
        ? {
            ...(tcpPayload ? { tcpPayload } : {}),
            ...(tcpExpectedResponse ? { tcpExpectedResponse } : {}),
          }
        : {}),
      ...(type === "dns"
        ? {
            dnsRecordType,
            ...(dnsExpectedValue ? { dnsExpectedValue } : {}),
            ...(dnsServer ? { dnsServer } : {}),
          }
        : {}),
      ...(type === "icmp"
        ? {
            icmpPacketCount: Number(icmpPacketCount) || 3,
            icmpMaxLossPercent: Number(icmpMaxLossPercent) || 50,
          }
        : {}),
    };

    try {
      if (monitor) {
        await api.updateMonitor(monitor.id, payload as any);
        void events.monitorEdited(type);
        setName("");
        setTarget("");
        setKeyword("");
        handleClose();
        onCreated?.();
      } else {
        const res = await api.createMonitor(payload as any);
        void events.monitorCreated(type, Number(intervalSeconds));
        if (type === "heartbeat" && res?.heartbeatToken) {
          setCreatedHeartbeat({ id: res.id, token: res.heartbeatToken, name: name || "Cron Heartbeat" });
        } else {
          setName("");
          setTarget("");
          setKeyword("");
          handleClose();
          onCreated?.();
        }
      }
    } catch (err) {
      void events.actionFailed(
        monitor ? "edit_monitor" : "create_monitor",
        err instanceof ApiError ? err.status : undefined
      );
      setError(
        err instanceof ApiError
          ? err.message
          : monitor
            ? "Could not save those changes"
            : "Could not create that monitor"
      );
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    if (isOpen !== undefined) return null;
    return (
      <button className="primary" onClick={() => setInternalOpen(true)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        New monitor
      </button>
    );
  }

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="modal-content" role="dialog" aria-modal="true">
        <div className="modal-header">
          <div>
            <h2>{isEditing ? t("formEditTitle") : t("formNewTitle")}</h2>
            <p className="dim" style={{ marginTop: "2px" }}>
              {isEditing
                ? "Changes take effect on the next check."
                : "Configure high-frequency checks and alerting."}
            </p>
          </div>
          <button
            type="button"
            className="btn-sm"
            onClick={handleClose}
            style={{ padding: "6px 8px", borderRadius: "50%" }}
            aria-label="Close modal"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {createdHeartbeat ? (
          <div className="modal-body" style={{ padding: "28px 24px", textAlign: "center" }}>
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                background: "rgba(63, 169, 201, 0.15)",
                border: "1px solid rgba(63, 169, 201, 0.4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px",
                color: "#3fa9c9",
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 600, color: "var(--text)", marginBottom: "8px" }}>
              Cron Heartbeat Created!
            </h3>
            <p className="dim" style={{ fontSize: "0.88rem", maxWidth: "440px", margin: "0 auto 20px", lineHeight: "1.4" }}>
              Your heartbeat monitor <strong style={{ color: "var(--text)" }}>{createdHeartbeat.name}</strong> is live and waiting for its first check-in.
            </p>

            <div
              style={{
                background: "rgba(0, 0, 0, 0.4)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                padding: "12px 14px",
                textAlign: "left",
                marginBottom: "16px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <span className="dim" style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                  Ping Ingest URL
                </span>
                <span className="dim" style={{ fontSize: "0.75rem", fontFamily: "var(--font-mono, monospace)" }}>
                  Token: {createdHeartbeat.token.slice(0, 8)}…
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <code
                  style={{
                    flex: 1,
                    fontFamily: "var(--font-mono, monospace)",
                    fontSize: "0.82rem",
                    color: "var(--text)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  https://api.uptimemonke.com/heartbeat/{createdHeartbeat.token}
                </code>
                <button
                  type="button"
                  className="btn-sm"
                  onClick={() => {
                    if (typeof navigator !== "undefined" && navigator.clipboard) {
                      navigator.clipboard.writeText(`https://api.uptimemonke.com/heartbeat/${createdHeartbeat.token}`);
                    }
                    setCopiedSuccessUrl(true);
                    setTimeout(() => setCopiedSuccessUrl(false), 2500);
                  }}
                  style={{
                    background: copiedSuccessUrl ? "rgba(63, 169, 201, 0.2)" : "var(--primary)",
                    color: copiedSuccessUrl ? "#3fa9c9" : "#fff",
                    padding: "4px 12px",
                    fontSize: "0.75rem",
                  }}
                >
                  {copiedSuccessUrl ? "✓ Copied!" : "Copy URL"}
                </button>
              </div>
            </div>

            <div
              style={{
                background: "rgba(0, 0, 0, 0.25)",
                border: "1px solid rgba(255, 255, 255, 0.06)",
                borderRadius: "8px",
                padding: "12px 14px",
                textAlign: "left",
                marginBottom: "22px",
              }}
            >
              <div className="dim" style={{ fontSize: "0.75rem", marginBottom: "6px" }}>
                Example Integration (cURL):
              </div>
              <code
                style={{
                  display: "block",
                  fontFamily: "var(--font-mono, monospace)",
                  fontSize: "0.78rem",
                  color: "#cbd5e1",
                  wordBreak: "break-all",
                }}
              >
                curl -fsS -m 10 https://api.uptimemonke.com/heartbeat/{createdHeartbeat.token}
              </code>
            </div>

            <button
              type="button"
              className="primary"
              onClick={handleClose}
              style={{ width: "100%", justifyContent: "center", padding: "10px 16px" }}
            >
              Done / Return to Dashboard
            </button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <div className="modal-body">
            {/* Monitor Type Grid */}
            <div className="field">
              <label>{t("formMonitorType")}</label>
              <div className="type-grid">
                {/* Locked while editing: an existing monitor's uptime history
                    and response times are only comparable within one protocol,
                    so switching type would silently corrupt its chart rather
                    than change a setting. Delete and recreate to change it. */}
                {TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.type}
                    type="button"
                    className={`type-btn ${type === opt.type ? "selected" : ""}`}
                    disabled={isEditing}
                    aria-disabled={isEditing}
                    title={
                      isEditing
                        ? "A monitor's protocol can't change — its history wouldn't match"
                        : opt.desc
                    }
                    style={
                      isEditing && type !== opt.type
                        ? { opacity: 0.35, cursor: "not-allowed" }
                        : isEditing
                          ? { cursor: "default" }
                          : undefined
                    }
                    onClick={() => {
                      if (isEditing) return;
                      setType(opt.type);
                      if (!target && opt.defaultTarget) setTarget(opt.defaultTarget);
                    }}
                  >
                    <MonitorTypeIcon type={opt.type} size={20} />
                    <span>{opt.label.split(" ")[0]}</span>
                  </button>
                ))}
              </div>
              <p className="dim">
                {isEditing
                  ? "Protocol is fixed for an existing monitor — its history wouldn't be comparable. Delete and recreate to change it."
                  : selectedOption.desc}
              </p>
            </div>

            {/* Target input */}
            {needsTarget && (
              <div className="field">
                <label htmlFor="nm-target">
                  {type === "http" || type === "keyword" ? t("formTargetUrl") : t("formTargetHost")}
                </label>
                <input
                  id="nm-target"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  placeholder={selectedOption.hint}
                  required
                  autoFocus
                />
              </div>
            )}

            {/* Keyword input */}
            {needsKeyword && (
              <div className="field">
                <label htmlFor="nm-keyword">{t("formKeyword")}</label>
                <input
                  id="nm-keyword"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder={t("formKeywordPlaceholder")}
                  required
                />
              </div>
            )}

            {/* Port input */}
            {needsPort && (
              <div className="field">
                <label htmlFor="nm-port">{t("formPort")}</label>
                <input
                  id="nm-port"
                  type="number"
                  min={1}
                  max={65535}
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  required
                />
              </div>
            )}

            {/* Monitor Friendly Name */}
            <div className="field">
              <label htmlFor="nm-name">{t("formFriendlyName")}</label>
              <input
                id="nm-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={target || t("formFriendlyNamePlaceholder")}
              />
            </div>

            {/* Check Frequency Chips */}
            <div className="field">
              <label>{t("formInterval")}</label>
              <div className="interval-chips">
                {[
                  { label: "5 sec", value: "5" },
                  { label: "30 sec", value: "30" },
                  { label: "1 min", value: "60" },
                  { label: "5 min", value: "300" },
                  { label: "15 min", value: "900" },
                  { label: "1 hour", value: "3600" },
                ].map((chip) => {
                  const belowPlan = Number(chip.value) < minInterval;
                  return (
                    <button
                      key={chip.value}
                      type="button"
                      disabled={belowPlan}
                      aria-disabled={belowPlan}
                      title={
                        belowPlan
                          ? `${planLabel ?? "Your"} plan checks at most every ${fmtInterval(
                              minInterval
                            )}`
                          : undefined
                      }
                      className={`interval-chip ${intervalSeconds === chip.value ? "selected" : ""}`}
                      style={belowPlan ? { opacity: 0.35, cursor: "not-allowed" } : undefined}
                      onClick={() => {
                        if (belowPlan) return;
                        setIntervalSeconds(chip.value);
                      }}
                    >
                      {chip.label}
                    </button>
                  );
                })}
              </div>
              <p className="dim" style={{ marginTop: "4px" }}>
                {minInterval > 5
                  ? `Faster intervals need an upgrade — the ${
                      planLabel ?? "current"
                    } plan checks every ${fmtInterval(minInterval)} at most.`
                  : "Sub-minute checks running from the edge probe fleet."}
              </p>
            </div>

            <div className="field">
              <label className="check-row" htmlFor="nm-public">
                <input
                  id="nm-public"
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                />
                <span>
                  <strong>{t("formPublicStatus")}</strong>
                  <span className="dim" style={{ display: "block", marginTop: "2px" }}>
                    {t("formPublicStatusDesc")}
                  </span>
                </span>
              </label>
            </div>

            {type === "ssl" && (
              <div className="field">
                <label>Warn me before the certificate expires</label>
                <div className="interval-chips">
                  {[60, 30, 14, 7, 3, 1].map((d) => {
                    const on = certAlertDays.includes(d);
                    return (
                      <button
                        key={d}
                        type="button"
                        className={`interval-chip ${on ? "selected" : ""}`}
                        onClick={() =>
                          setCertAlertDays((cur) =>
                            (on ? cur.filter((x) => x !== d) : [...cur, d]).sort(
                              (a, b) => b - a
                            )
                          )
                        }
                      >
                        {d === 1 ? "1 day" : `${d} days`}
                      </button>
                    );
                  })}
                </div>
                <p className="dim" style={{ marginTop: 4 }}>
                  {certAlertDays.length
                    ? `Each fires once, and a renewal resets them. An expiring certificate
                       does not mark the monitor down — the site still works until it expires.`
                    : "Pick at least one, or the default (30, 14, 7, 1) is used."}
                </p>
              </div>
            )}

            <div className="field">
              <label>{t("formAlertContacts")}</label>
              {verified.length === 0 ? (
                <p className="dim">
                  No confirmed contacts yet — nothing can be paged. Add one
                  under <strong>Alerts</strong> in the header.
                </p>
              ) : (
                <>
                  <div className="contact-picker">
                    <label className="check-row" htmlFor="nm-all">
                      <input
                        id="nm-all"
                        type="checkbox"
                        checked={contactIds.length === 0}
                        onChange={(e) => setContactIds(e.target.checked ? [] : verified.map((c) => c.id))}
                      />
                      <span>
                        {t("formAllContacts")}
                        <span className="dim" style={{ display: "block", marginTop: "2px" }}>
                          All {verified.length} confirmed contact
                          {verified.length === 1 ? "" : "s"}, including any added later.
                        </span>
                      </span>
                    </label>

                    {contactIds.length > 0 &&
                      verified.map((c) => (
                        <label key={c.id} className="check-row" htmlFor={`nm-c-${c.id}`}>
                          <input
                            id={`nm-c-${c.id}`}
                            type="checkbox"
                            checked={contactIds.includes(c.id)}
                            onChange={(e) =>
                              setContactIds((ids) =>
                                e.target.checked
                                  ? [...ids, c.id]
                                  : ids.filter((id) => id !== c.id)
                              )
                            }
                          />
                          <span>
                            {c.name}
                            <span className="dim" style={{ display: "block" }}>
                              {c.channel} · {c.destination}
                            </span>
                          </span>
                        </label>
                      ))}
                  </div>

                  <label className="check-row" htmlFor="nm-mute" style={{ marginTop: "10px" }}>
                    <input
                      id="nm-mute"
                      type="checkbox"
                      checked={muteAlerts}
                      onChange={(e) => setMuteAlerts(e.target.checked)}
                    />
                    <span>
                      <strong>{t("formMuteAlerts")}</strong>
                      <span className="dim" style={{ display: "block", marginTop: "2px" }}>
                        {t("formMuteAlertsDesc")}
                      </span>
                    </span>
                  </label>
                </>
              )}
            </div>

            {/* Advanced Configuration Accordion */}
            <div style={{ marginTop: "16px", marginBottom: "16px" }}>
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 14px",
                  background: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: "8px",
                  color: "var(--text-main, #e2e8f0)",
                  cursor: "pointer",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  transition: "all 0.15s ease",
                }}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                  <span>⚙️</span>
                  <span>Advanced Options ({selectedOption.label})</span>
                </span>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted, #94a3b8)" }}>
                  {showAdvanced ? "Hide ▲" : "Configure ▼"}
                </span>
              </button>

              {showAdvanced && (
                <div
                  style={{
                    marginTop: "8px",
                    padding: "14px",
                    background: "rgba(0, 0, 0, 0.2)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    borderRadius: "8px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                  }}
                >
                  {/* HTTP & Keyword Advanced */}
                  {(type === "http" || type === "keyword") && (
                    <>
                      <div className="field">
                        <label htmlFor="nm-method">HTTP Method</label>
                        <select
                          id="nm-method"
                          value={method}
                          onChange={(e) => setMethod(e.target.value)}
                          style={{
                            width: "100%",
                            padding: "8px 12px",
                            background: "var(--bg-input, rgba(255,255,255,0.05))",
                            border: "1px solid rgba(255,255,255,0.15)",
                            borderRadius: "6px",
                            color: "#fff",
                          }}
                        >
                          <option value="GET">GET (Standard)</option>
                          {type === "http" && <option value="HEAD">HEAD (Fast, No Body)</option>}
                          <option value="POST">POST</option>
                          <option value="PUT">PUT</option>
                          <option value="PATCH">PATCH</option>
                          <option value="DELETE">DELETE</option>
                          {type === "http" && <option value="OPTIONS">OPTIONS</option>}
                        </select>
                      </div>

                      <div className="field">
                        <label htmlFor="nm-sla">Response Time SLA Threshold (ms)</label>
                        <input
                          id="nm-sla"
                          type="number"
                          min={50}
                          max={60000}
                          value={maxResponseTimeMs}
                          onChange={(e) => setMaxResponseTimeMs(e.target.value)}
                          placeholder="e.g. 2500 (leave blank for standard timeout)"
                        />
                        <span className="dim" style={{ fontSize: "0.75rem", marginTop: "2px" }}>
                          Alerts if response time exceeds this threshold, even if HTTP status is 200 OK.
                        </span>
                      </div>
                    </>
                  )}

                  {/* Keyword Advanced */}
                  {type === "keyword" && (
                    <>
                      <label className="check-row" htmlFor="nm-kw-regex">
                        <input
                          id="nm-kw-regex"
                          type="checkbox"
                          checked={keywordRegex}
                          onChange={(e) => setKeywordRegex(e.target.checked)}
                        />
                        <span>
                          <strong>Regular Expression (Regex)</strong>
                          <span className="dim" style={{ display: "block" }}>
                            Evaluates keyword as a regex pattern (e.g. <code>/v[0-9]+\.[0-9]+/i</code>).
                          </span>
                        </span>
                      </label>

                      <div className="field">
                        <label htmlFor="nm-json-path">JSON Path Assertion (Optional)</label>
                        <input
                          id="nm-json-path"
                          value={jsonPath}
                          onChange={(e) => setJsonPath(e.target.value)}
                          placeholder="e.g. status or services.database.healthy"
                        />
                        <span className="dim" style={{ fontSize: "0.75rem", marginTop: "2px" }}>
                          Validates API response JSON property directly without full HTML scanning.
                        </span>
                      </div>

                      {jsonPath && (
                        <div className="field">
                          <label htmlFor="nm-json-expected">Expected JSON Value</label>
                          <input
                            id="nm-json-expected"
                            value={jsonPathExpected}
                            onChange={(e) => setJsonPathExpected(e.target.value)}
                            placeholder="e.g. ok or true or 1"
                          />
                        </div>
                      )}
                    </>
                  )}

                  {/* SSL Advanced */}
                  {type === "ssl" && (
                    <>
                      <div className="field">
                        <label htmlFor="nm-ssl-warn">Expiry Warning Window (Days)</label>
                        <input
                          id="nm-ssl-warn"
                          type="number"
                          min={1}
                          max={365}
                          value={sslExpiryWarningDays}
                          onChange={(e) => setSslExpiryWarningDays(e.target.value)}
                        />
                        <span className="dim" style={{ fontSize: "0.75rem" }}>
                          Triggers an alert when the certificate is within this many days of expiration.
                        </span>
                      </div>

                      <div className="field">
                        <label htmlFor="nm-ssl-minver">Minimum TLS Protocol Version</label>
                        <select
                          id="nm-ssl-minver"
                          value={sslMinVersion}
                          onChange={(e) => setSslMinVersion(e.target.value)}
                          style={{
                            width: "100%",
                            padding: "8px 12px",
                            background: "var(--bg-input, rgba(255,255,255,0.05))",
                            border: "1px solid rgba(255,255,255,0.15)",
                            borderRadius: "6px",
                            color: "#fff",
                          }}
                        >
                          <option value="none">Any Supported TLS Version</option>
                          <option value="TLSv1.2">Enforce TLS 1.2+ (Reject TLS 1.0/1.1)</option>
                          <option value="TLSv1.3">Enforce TLS 1.3 Only</option>
                        </select>
                      </div>

                      <div className="field">
                        <label htmlFor="nm-ssl-fp">Certificate SHA-256 Fingerprint Pinning (Optional)</label>
                        <input
                          id="nm-ssl-fp"
                          value={sslExpectedFingerprint}
                          onChange={(e) => setSslExpectedFingerprint(e.target.value)}
                          placeholder="e.g. AA:BB:CC:DD:... (Hex SHA-256)"
                        />
                        <span className="dim" style={{ fontSize: "0.75rem" }}>
                          Alerts immediately if the certificate fingerprint changes.
                        </span>
                      </div>
                    </>
                  )}

                  {/* TCP Advanced */}
                  {type === "tcp" && (
                    <>
                      <div className="field">
                        <label htmlFor="nm-tcp-payload">Send Payload / Handshake String (Optional)</label>
                        <input
                          id="nm-tcp-payload"
                          value={tcpPayload}
                          onChange={(e) => setTcpPayload(e.target.value)}
                          placeholder="e.g. PING\r\n or EHLO domain\r\n"
                        />
                        <span className="dim" style={{ fontSize: "0.75rem" }}>
                          Sends raw bytes over the TCP socket immediately upon connection.
                        </span>
                      </div>

                      <div className="field">
                        <label htmlFor="nm-tcp-banner">Expected Response Banner (Optional)</label>
                        <input
                          id="nm-tcp-banner"
                          value={tcpExpectedResponse}
                          onChange={(e) => setTcpExpectedResponse(e.target.value)}
                          placeholder="e.g. +PONG, 220, or SSH-2.0-"
                        />
                        <span className="dim" style={{ fontSize: "0.75rem" }}>
                          Asserts that the daemon responds with the expected protocol banner.
                        </span>
                      </div>
                    </>
                  )}

                  {/* DNS Advanced */}
                  {type === "dns" && (
                    <>
                      <div className="field">
                        <label htmlFor="nm-dns-type">Record Type</label>
                        <select
                          id="nm-dns-type"
                          value={dnsRecordType}
                          onChange={(e) => setDnsRecordType(e.target.value)}
                          style={{
                            width: "100%",
                            padding: "8px 12px",
                            background: "var(--bg-input, rgba(255,255,255,0.05))",
                            border: "1px solid rgba(255,255,255,0.15)",
                            borderRadius: "6px",
                            color: "#fff",
                          }}
                        >
                          {["A", "AAAA", "CNAME", "MX", "TXT", "NS", "CAA", "SOA", "PTR", "SRV"].map((rt) => (
                            <option key={rt} value={rt}>
                              {rt} Record
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="field">
                        <label htmlFor="nm-dns-expected">Expected Value or Substring</label>
                        <input
                          id="nm-dns-expected"
                          value={dnsExpectedValue}
                          onChange={(e) => setDnsExpectedValue(e.target.value)}
                          placeholder="e.g. 192.0.2.1 or v=spf1"
                        />
                      </div>

                      <div className="field">
                        <label htmlFor="nm-dns-server">Custom Nameserver / Resolver IP (Optional)</label>
                        <input
                          id="nm-dns-server"
                          value={dnsServer}
                          onChange={(e) => setDnsServer(e.target.value)}
                          placeholder="e.g. 1.1.1.1, 8.8.8.8, or authoritative NS IP"
                        />
                        <span className="dim" style={{ fontSize: "0.75rem" }}>
                          Leave blank to use default high-availability resolvers (Cloudflare &amp; Google).
                        </span>
                      </div>
                    </>
                  )}

                  {/* ICMP Advanced */}
                  {type === "icmp" && (
                    <>
                      <div className="field">
                        <label htmlFor="nm-icmp-count">Ping Packet Train Count</label>
                        <select
                          id="nm-icmp-count"
                          value={icmpPacketCount}
                          onChange={(e) => setIcmpPacketCount(e.target.value)}
                          style={{
                            width: "100%",
                            padding: "8px 12px",
                            background: "var(--bg-input, rgba(255,255,255,0.05))",
                            border: "1px solid rgba(255,255,255,0.15)",
                            borderRadius: "6px",
                            color: "#fff",
                          }}
                        >
                          <option value="1">1 Packet (Fastest)</option>
                          <option value="3">3 Packets (Recommended, measures loss %)</option>
                          <option value="5">5 Packets (High precision)</option>
                        </select>
                      </div>

                      <div className="field">
                        <label htmlFor="nm-icmp-loss">Max Tolerable Packet Loss (%)</label>
                        <input
                          id="nm-icmp-loss"
                          type="number"
                          min={1}
                          max={100}
                          value={icmpMaxLossPercent}
                          onChange={(e) => setIcmpMaxLossPercent(e.target.value)}
                          placeholder="e.g. 50"
                        />
                        <span className="dim" style={{ fontSize: "0.75rem" }}>
                          Alerts if packet loss exceeds this threshold (e.g. 33% or 50%).
                        </span>
                      </div>
                    </>
                  )}

                  {/* Heartbeat Advanced */}
                  {type === "heartbeat" && (
                    <div style={{ fontSize: "0.8rem", color: "var(--text-muted, #94a3b8)" }}>
                      {monitor?.heartbeatToken ? (
                        <div
                          style={{
                            background: "rgba(59, 130, 246, 0.08)",
                            border: "1px solid rgba(59, 130, 246, 0.25)",
                            borderRadius: "6px",
                            padding: "10px 12px",
                            marginBottom: "12px",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                            <strong style={{ color: "var(--text)", fontSize: "0.8rem" }}>Active Heartbeat Ingest URL</strong>
                            <button
                              type="button"
                              className="btn-xs"
                              onClick={() => {
                                if (typeof navigator !== "undefined" && navigator.clipboard) {
                                  navigator.clipboard.writeText(`https://api.uptimemonke.com/heartbeat/${monitor.heartbeatToken}`);
                                }
                                setCopiedToken(true);
                                setTimeout(() => setCopiedToken(false), 2500);
                              }}
                              style={{
                                background: copiedToken ? "rgba(63, 169, 201, 0.2)" : "rgba(255, 255, 255, 0.1)",
                                color: copiedToken ? "#3fa9c9" : "var(--text)",
                                border: "1px solid var(--border)",
                                borderRadius: "4px",
                                padding: "2px 8px",
                                fontSize: "0.72rem",
                                cursor: "pointer",
                              }}
                            >
                              {copiedToken ? "✓ Copied URL" : "Copy URL"}
                            </button>
                          </div>
                          <code style={{ fontFamily: "var(--font-mono, monospace)", fontSize: "0.75rem", color: "var(--text)", wordBreak: "break-all" }}>
                            https://api.uptimemonke.com/heartbeat/{monitor.heartbeatToken}
                          </code>
                        </div>
                      ) : null}
                      <p style={{ marginBottom: "6px" }}>
                        💡 <strong>Heartbeat Push API:</strong>
                      </p>
                      <div
                        style={{
                          background: "rgba(0,0,0,0.4)",
                          padding: "8px 10px",
                          borderRadius: "6px",
                          fontFamily: "monospace",
                          fontSize: "0.75rem",
                          lineHeight: "1.4",
                        }}
                      >
                        # Success check-in:<br />
                        curl https://api.uptimemonke.com/heartbeat/{monitor?.heartbeatToken || "&lt;token&gt;"}<br /><br />
                        # Immediate failure report:<br />
                        curl -X POST https://api.uptimemonke.com/heartbeat/{monitor?.heartbeatToken || "&lt;token&gt;"} -d &#39;&#123;&quot;status&quot;:&quot;fail&quot;,&quot;error&quot;:&quot;Job crashed&quot;&#125;&#39;
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {error && (
              <div
                style={{
                  background: "rgba(244, 63, 94, 0.12)",
                  border: "1px solid rgba(244, 63, 94, 0.3)",
                  borderRadius: "8px",
                  padding: "10px 14px",
                  color: "#fb7185",
                  fontSize: "0.85rem",
                  marginBottom: "14px",
                }}
                role="alert"
              >
                {error}
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" onClick={handleClose} disabled={busy}>
              {t("formCancelBtn")}
            </button>
            <button className="primary" type="submit" disabled={busy}>
              {busy
                ? isEditing
                  ? t("formSaving")
                  : t("formCreating")
                : isEditing
                  ? t("formSaveBtn")
                  : t("formCreateBtn")}
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
}
