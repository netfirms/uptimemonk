"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/api";

type MonitorType = "http" | "keyword" | "tcp" | "dns" | "ssl" | "icmp" | "heartbeat";

const TYPE_LABELS: Record<MonitorType, string> = {
  http: "Website (HTTP)",
  icmp: "Ping (ICMP)",
  keyword: "Keyword in page",
  tcp: "Port (TCP)",
  dns: "DNS record",
  ssl: "SSL certificate",
  heartbeat: "Cron heartbeat",
};

const TARGET_HINTS: Record<MonitorType, string> = {
  http: "https://example.com",
  keyword: "https://example.com",
  icmp: "example.com",
  tcp: "example.com",
  dns: "example.com",
  ssl: "example.com",
  heartbeat: "",
};

/**
 * Creating a monitor goes through the probe box's API, not a direct Firestore
 * write: plan limits need a count and a safe target needs a DNS resolution,
 * and security rules can do neither. The errors it returns are written to be
 * shown to the user as-is.
 */
export default function NewMonitorForm({ onCreated }: { onCreated?: () => void }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<MonitorType>("http");
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [keyword, setKeyword] = useState("");
  const [port, setPort] = useState("443");
  const [intervalSeconds, setIntervalSeconds] = useState("300");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        name: name || target,
        target,
        intervalSeconds: Number(intervalSeconds),
        ...(needsKeyword ? { keyword } : {}),
        ...(needsPort ? { port: Number(port) } : {}),
      });
      setName("");
      setTarget("");
      setKeyword("");
      setOpen(false);
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
    return (
      <button className="primary" onClick={() => setOpen(true)}>
        New monitor
      </button>
    );
  }

  return (
    <form className="card" onSubmit={submit}>
      <div className="field">
        <label htmlFor="nm-type">What should we watch?</label>
        <select
          id="nm-type"
          value={type}
          onChange={(e) => setType(e.target.value as MonitorType)}
        >
          {Object.entries(TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {needsTarget && (
        <div className="field">
          <label htmlFor="nm-target">
            {type === "http" || type === "keyword" ? "URL" : "Hostname"}
          </label>
          <input
            id="nm-target"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder={TARGET_HINTS[type]}
            required
          />
        </div>
      )}

      {needsKeyword && (
        <div className="field">
          <label htmlFor="nm-keyword">Page must contain</label>
          <input
            id="nm-keyword"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Sign in"
            required
          />
        </div>
      )}

      {needsPort && (
        <div className="field">
          <label htmlFor="nm-port">Port</label>
          <input
            id="nm-port"
            type="number"
            min={1}
            max={65535}
            value={port}
            onChange={(e) => setPort(e.target.value)}
          />
        </div>
      )}

      <div className="field">
        <label htmlFor="nm-name">Name</label>
        <input
          id="nm-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={target || "My website"}
        />
      </div>

      <div className="field">
        <label htmlFor="nm-interval">Check every</label>
        <select
          id="nm-interval"
          value={intervalSeconds}
          onChange={(e) => setIntervalSeconds(e.target.value)}
        >
          <option value="60">1 minute</option>
          <option value="300">5 minutes</option>
          <option value="900">15 minutes</option>
          <option value="3600">1 hour</option>
        </select>
        <p className="muted">
          Faster intervals than your plan allows are raised to its minimum.
        </p>
      </div>

      {error && (
        <p className="muted" style={{ color: "var(--down)" }} role="alert">
          {error}
        </p>
      )}

      <div className="row">
        <button className="primary" type="submit" disabled={busy}>
          {busy ? "Creating…" : "Create monitor"}
        </button>
        <button type="button" onClick={() => setOpen(false)} disabled={busy}>
          Cancel
        </button>
      </div>
    </form>
  );
}
