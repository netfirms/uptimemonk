"use client";

import { useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
} from "firebase/auth";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { api, ApiError } from "@/lib/api";
import NewMonitorForm from "./NewMonitorForm";

type Status = "up" | "down" | "pending" | "paused";

/** Configuration, owned by Firestore. */
interface MonitorConfig {
  id: string;
  name: string;
  target: string;
  type: string;
  enabled?: boolean;
}

/** Live state, written by the probe box into one document per org. */
interface LiveState {
  status: Status;
  inMaintenance?: boolean;
  lastResponseTimeMs?: number | null;
  lastError?: string | null;
  uptime30d?: number | null;
}

/**
 * The dashboard joins two realtime listeners: monitor configuration, which
 * changes rarely, and the org's status mirror, which the probe box rewrites on
 * every state change and every few minutes otherwise.
 *
 * Per-check history deliberately never reaches Firestore — it lives in SQLite
 * on the box — which is what keeps this inside the free tier no matter how
 * many monitors an account has.
 */
export default function Dashboard() {
  const [uid, setUid] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [monitors, setMonitors] = useState<MonitorConfig[]>([]);
  const [live, setLive] = useState<Record<string, LiveState>>({});
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(
    () =>
      onAuthStateChanged(auth, async (user) => {
        setUid(user?.uid ?? null);
        if (!user) return setOrgId(null);

        const token = await user.getIdTokenResult();
        let id = (token.claims.orgId as string) ?? null;

        // A brand-new account has no workspace yet, because the free tier has
        // no signup hook. Ask the box to make one, then refresh the token so
        // the new claim is present.
        if (!id) {
          try {
            const { orgId: created } = await api.bootstrap();
            await user.getIdToken(true);
            id = created;
          } catch (err) {
            setError(
              err instanceof ApiError
                ? err.message
                : "Could not set up your workspace. Try reloading."
            );
          }
        }
        setOrgId(id);
      }),
    []
  );

  // Configuration.
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

  // Live state.
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
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update that monitor.");
    } finally {
      setBusyId(null);
    }
  }

  if (!uid) {
    return (
      <main className="wrap">
        <h1>UptimeMonk</h1>
        <button className="primary" onClick={() => signInWithPopup(auth, new GoogleAuthProvider())}>
          Sign in with Google
        </button>
      </main>
    );
  }

  const statusOf = (m: MonitorConfig): Status => {
    if (m.enabled === false) return "paused";
    return live[m.id]?.status ?? "pending";
  };
  const down = monitors.filter((m) => statusOf(m) === "down").length;

  return (
    <main className="wrap">
      <div className="row">
        <h1 className="grow">Monitors</h1>
        <NewMonitorForm />
        <button onClick={() => signOut(auth)}>Sign out</button>
      </div>

      <p className="muted">
        {monitors.length} monitors ·{" "}
        {down ? `${down} down` : "all systems operational"}
      </p>

      {error && (
        <p className="muted" style={{ color: "var(--down)" }} role="alert">
          {error}
        </p>
      )}

      {monitors.map((m) => {
        const status = statusOf(m);
        const state = live[m.id];
        return (
          <div key={m.id} className="card">
            <div className="row">
              <span className={`dot ${state?.inMaintenance ? "maintenance" : status}`} />
              <div className="grow">
                <strong>{m.name}</strong>
                <div className="muted">{m.target || m.type}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div>
                  {state?.lastResponseTimeMs != null ? `${state.lastResponseTimeMs} ms` : "—"}
                </div>
                <div className="muted">
                  {state?.uptime30d != null
                    ? `${state.uptime30d.toFixed(2)}% / 30d`
                    : "collecting…"}
                </div>
              </div>
              <button onClick={() => togglePause(m)} disabled={busyId === m.id}>
                {m.enabled === false ? "Resume" : "Pause"}
              </button>
            </div>
            {status === "down" && state?.lastError && (
              <p className="muted" style={{ color: "var(--down)" }}>
                {state.lastError}
              </p>
            )}
          </div>
        );
      })}

      {!monitors.length && (
        <p className="muted">No monitors yet — add your first one above.</p>
      )}

      <footer
        className="muted"
        style={{
          marginTop: "3rem",
          paddingTop: "1rem",
          borderTop: "1px solid var(--border, #222)",
          display: "flex",
          justifyContent: "space-between",
          fontSize: "0.85rem",
        }}
      >
        <span>UptimeMonk</span>
        <span>v{process.env.NEXT_PUBLIC_APP_VERSION ?? "0.1.0"}</span>
      </footer>
    </main>
  );
}
