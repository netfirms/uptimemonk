"use client";

import { useCallback, useEffect, useState } from "react";
import { auth } from "@/lib/firebase";

/**
 * The operator inbox for the contact / suggestion form.
 *
 * Its own component rather than another section inside `page.tsx`, which is
 * already 3,000 lines and reloads every panel's data on one effect. This owns
 * its own fetch so a slow inbox cannot delay the fleet view, and a failure
 * here degrades to a message in this panel rather than an error across the
 * whole console.
 */

const API = "https://api.uptimemonke.com";

type Status = "new" | "read" | "archived";

interface Message {
  id: string;
  createdAt: number;
  kind: string;
  message: string;
  email: string;
  name: string;
  uid: string | null;
  source: string;
  appVersion: string | null;
  status: Status;
  operatorNote: string;
}

const KIND_LABEL: Record<string, string> = {
  suggestion: "Suggestion",
  bug: "Bug",
  question: "Question",
  other: "Other",
};

function when(ms: number): string {
  const secs = Math.round((Date.now() - ms) / 1000);
  if (secs < 60) return "just now";
  if (secs < 3600) return `${Math.round(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.round(secs / 3600)}h ago`;
  return new Date(ms).toLocaleDateString();
}

export default function FeedbackPanel() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [counts, setCounts] = useState<Record<Status, number>>({ new: 0, read: 0, archived: 0 });
  const [filter, setFilter] = useState<Status | "all">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const qs = filter === "all" ? "" : `?status=${filter}`;
      const res = await fetch(`${API}/v1/admin/feedback${qs}`, {
        headers: { authorization: `Bearer ${token}` },
      });
      if (res.status === 403) throw new Error("Not an operator account.");
      if (!res.ok) throw new Error(`The inbox returned ${res.status}.`);
      const body = await res.json();
      setMessages(body.messages ?? []);
      setCounts(body.counts ?? { new: 0, read: 0, archived: 0 });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load messages.");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  async function patch(id: string, body: { status?: Status; operatorNote?: string }) {
    const user = auth.currentUser;
    if (!user) return;
    setBusy((b) => new Set(b).add(id));
    try {
      const token = await user.getIdToken();
      const res = await fetch(`${API}/v1/admin/feedback/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Update returned ${res.status}.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update that message.");
    } finally {
      setBusy((b) => {
        const n = new Set(b);
        n.delete(id);
        return n;
      });
    }
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <div className="panel-title-wrap">
          <span style={{ fontSize: "1.2rem" }}>✉️</span>
          <div>
            <h2 className="panel-title">
              Feedback Inbox
              {counts.new > 0 && <span className="feedback-badge">{counts.new}</span>}
            </h2>
            <p className="panel-desc">
              Messages from the contact form on the site and in the apps.
            </p>
          </div>
        </div>
        <button type="button" className="fb-refresh" onClick={() => void load()} disabled={loading}>
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      <div className="filter-bar">
        <div className="filter-group">
          {(["all", "new", "read", "archived"] as const).map((f) => (
            <button
              key={f}
              type="button"
              className={`fb-filter${filter === f ? " is-active" : ""}`}
              onClick={() => setFilter(f)}
            >
              {f === "all" ? "All" : f[0].toUpperCase() + f.slice(1)}
              {f !== "all" && <span className="fb-filter-count">{counts[f]}</span>}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="fb-error">{error}</p>}

      {!loading && messages.length === 0 && !error && (
        <p className="fb-empty">
          {filter === "all"
            ? "Nothing yet. Messages from the contact form land here."
            : `No ${filter} messages.`}
        </p>
      )}

      <div className="fb-list">
        {messages.map((m) => (
          <article key={m.id} className={`fb-item${m.status === "new" ? " is-new" : ""}`}>
            <header className="fb-item-head">
              <div className="fb-item-who">
                <span className={`fb-kind fb-kind-${m.kind}`}>
                  {KIND_LABEL[m.kind] ?? m.kind}
                </span>
                <span className="fb-email">{m.name ? `${m.name} · ` : ""}{m.email}</span>
                {/* An anonymous sender is the less trustworthy path and should
                    be visible at a glance, not inferred from a blank field. */}
                {!m.uid && <span className="fb-anon" title="Sent without signing in">anonymous</span>}
              </div>
              <div className="fb-item-meta">
                <span>{m.source}</span>
                {m.appVersion && <span>v{m.appVersion}</span>}
                <span title={new Date(m.createdAt).toISOString()}>{when(m.createdAt)}</span>
              </div>
            </header>

            {/* Pre-wrap, not a paragraph: people write in lines and a bug
                report with its formatting collapsed is harder to read. */}
            <p className="fb-message">{m.message}</p>

            {m.operatorNote && <p className="fb-note">Note: {m.operatorNote}</p>}

            <footer className="fb-actions">
              <a className="fb-reply" href={`mailto:${m.email}?subject=Re:%20your%20message%20to%20UptimeMonke`}>
                Reply
              </a>
              {m.status !== "read" && (
                <button type="button" disabled={busy.has(m.id)} onClick={() => void patch(m.id, { status: "read" })}>
                  Mark read
                </button>
              )}
              {m.status !== "archived" && (
                <button type="button" disabled={busy.has(m.id)} onClick={() => void patch(m.id, { status: "archived" })}>
                  Archive
                </button>
              )}
              {m.status !== "new" && (
                <button type="button" disabled={busy.has(m.id)} onClick={() => void patch(m.id, { status: "new" })}>
                  Reopen
                </button>
              )}
            </footer>
          </article>
        ))}
      </div>
    </section>
  );
}
