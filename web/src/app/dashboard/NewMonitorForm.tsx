"use client";

import { useState, useEffect } from "react";
import { api, ApiError, type AlertContact } from "@/lib/api";
import { events } from "@/lib/analytics";

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
  publicOnStatusPage?: boolean;
  muteAlerts?: boolean;
  alertContactIds?: string[];
}

export default function NewMonitorForm({
  isOpen,
  onClose,
  onCreated,
  monitor,
}: {
  isOpen?: boolean;
  onClose?: () => void;
  onCreated?: () => void;
  /** Present = edit that monitor. Absent = create a new one. */
  monitor?: EditableMonitor | null;
}) {
  const isEditing = !!monitor;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isOpen !== undefined ? isOpen : internalOpen;
  const handleClose = () => {
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
  const [contacts, setContacts] = useState<AlertContact[] | null>(null);
  /** Empty means "everyone verified", which is what the server does too. */
  const [contactIds, setContactIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
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
      setContactIds(monitor.alertContactIds ?? []);
    } else {
      setType("http");
      setName("");
      setTarget("");
      setKeyword("");
      setPort("443");
      setIntervalSeconds("300");
      // A new monitor is private until someone says otherwise.
      setIsPublic(false);
      setMuteAlerts(false);
      setContactIds([]);
    }
    setError(null);
  }, [open, monitor?.id]);

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
    const payload = {
      type,
      name: name || target || selectedOption.label,
      target,
      intervalSeconds: Number(intervalSeconds),
      publicOnStatusPage: isPublic,
      muteAlerts,
      alertContactIds: contactIds,
      ...(needsKeyword ? { keyword } : {}),
      ...(needsPort ? { port: Number(port) } : {}),
    };

    try {
      if (monitor) {
        await api.updateMonitor(monitor.id, payload);
        void events.monitorEdited(type);
      } else {
        await api.createMonitor(payload);
        void events.monitorCreated(type, Number(intervalSeconds));
      }

      setName("");
      setTarget("");
      setKeyword("");
      handleClose();
      onCreated?.();
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
            <h2>{isEditing ? "Edit Monitor" : "Create New Monitor"}</h2>
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

        <form onSubmit={submit}>
          <div className="modal-body">
            {/* Monitor Type Grid */}
            <div className="field">
              <label>Monitor Protocol</label>
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
                  {type === "http" || type === "keyword" ? "URL to Monitor" : "Host or IP"}
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
                <label htmlFor="nm-keyword">Expected Keyword on Page</label>
                <input
                  id="nm-keyword"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="e.g. Sign in, Welcome, Operational"
                  required
                />
              </div>
            )}

            {/* Port input */}
            {needsPort && (
              <div className="field">
                <label htmlFor="nm-port">Target Port</label>
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
              <label htmlFor="nm-name">Friendly Name (Optional)</label>
              <input
                id="nm-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={target || "e.g. Production Web API"}
              />
            </div>

            {/* Check Frequency Chips */}
            <div className="field">
              <label>Check Frequency</label>
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
                  <strong>Show on public status page</strong>
                  <span className="dim" style={{ display: "block", marginTop: "2px" }}>
                    Publishes this check&apos;s name, current state and 90-day
                    uptime to your status page. The URL you are watching stays
                    private.
                  </span>
                </span>
              </label>
            </div>

            <div className="field">
              <label>Alerts</label>
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
                        Alert everyone
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
                      <strong>Mute alerts</strong>
                      <span className="dim" style={{ display: "block", marginTop: "2px" }}>
                        Keep checking and recording incidents, but page nobody.
                      </span>
                    </span>
                  </label>
                </>
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
              Cancel
            </button>
            <button className="primary" type="submit" disabled={busy}>
              {busy
                ? isEditing
                  ? "Saving…"
                  : "Deploying Check…"
                : isEditing
                  ? "Save Changes"
                  : "Create Monitor"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
