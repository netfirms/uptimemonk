"use client";

import { useState, useEffect } from "react";
import { api, ApiError } from "@/lib/api";

export type MonitorType = "http" | "keyword" | "tcp" | "dns" | "ssl" | "icmp" | "heartbeat";

interface TypeOption {
  type: MonitorType;
  label: string;
  hint: string;
  defaultTarget: string;
  desc: string;
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

export default function NewMonitorForm({
  isOpen,
  onClose,
  onCreated,
}: {
  isOpen?: boolean;
  onClose?: () => void;
  onCreated?: () => void;
}) {
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.createMonitor({
        type,
        name: name || target || selectedOption.label,
        target,
        intervalSeconds: Number(intervalSeconds),
        ...(needsKeyword ? { keyword } : {}),
        ...(needsPort ? { port: Number(port) } : {}),
      });
      setName("");
      setTarget("");
      setKeyword("");
      handleClose();
      onCreated?.();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not create that monitor"
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
            <h2>Create New Monitor</h2>
            <p className="dim" style={{ marginTop: "2px" }}>
              Configure high-frequency checks and alerting.
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
                {TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.type}
                    type="button"
                    className={`type-btn ${type === opt.type ? "selected" : ""}`}
                    onClick={() => {
                      setType(opt.type);
                      if (!target && opt.defaultTarget) setTarget(opt.defaultTarget);
                    }}
                  >
                    <MonitorTypeIcon type={opt.type} size={20} />
                    <span>{opt.label.split(" ")[0]}</span>
                  </button>
                ))}
              </div>
              <p className="dim">{selectedOption.desc}</p>
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
                  { label: "1 min", value: "60" },
                  { label: "5 min", value: "300" },
                  { label: "15 min", value: "900" },
                  { label: "1 hour", value: "3600" },
                ].map((chip) => (
                  <button
                    key={chip.value}
                    type="button"
                    className={`interval-chip ${intervalSeconds === chip.value ? "selected" : ""}`}
                    onClick={() => setIntervalSeconds(chip.value)}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
              <p className="dim" style={{ marginTop: "4px" }}>
                Lightweight checks running from global edge probes.
              </p>
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
              {busy ? "Deploying Check…" : "Create Monitor"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
