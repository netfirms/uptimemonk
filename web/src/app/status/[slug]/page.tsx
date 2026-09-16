import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { adminDb } from "@/lib/admin";

/**
 * Public status page — server-rendered and revalidated, not client-fetched.
 *
 * ISR is what makes this nearly free: one render per minute serves every
 * visitor, so a page that goes viral during an outage costs ~60 Firestore
 * reads an hour instead of 60 per visitor. This is exactly the moment you
 * cannot afford a surprise bill.
 */
export const revalidate = 60;
export const dynamicParams = false;

export function generateStaticParams() {
  return [{ slug: "_default" }];
}

interface DayDoc {
  day: string;
  uptimeRatio: number;
}

interface MonitorDoc {
  id: string;
  name: string;
  status: string;
  uptime30d?: number;
  days: DayDoc[];
}

async function loadPage(slug: string) {
  try {
    const snap = await adminDb
      .collection("statusPages")
      .where("slug", "==", slug)
      .where("published", "==", true)
      .limit(1)
      .get();
    if (snap.empty) return null;
    return { id: snap.docs[0].id, ...(snap.docs[0].data() as Record<string, unknown>) } as {
      id: string;
      title: string;
      description?: string;
      monitorIds: string[];
      showResponseTimes: boolean;
    };
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = await loadPage(slug);
  return {
    title: page ? `${page.title} status` : "Status",
    description: page?.description ?? "Live service status",
  };
}

export default async function StatusPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = await loadPage(slug);
  if (!page) notFound();

  const monitors: MonitorDoc[] = await Promise.all(
    (page.monitorIds ?? []).map(async (id) => {
      const doc = await adminDb.collection("monitors").doc(id).get();
      const days = await adminDb
        .collection("monitors")
        .doc(id)
        .collection("days")
        .orderBy("day", "desc")
        .limit(90)
        .get();
      const d = doc.data() ?? {};
      return {
        id,
        name: (d.name as string) ?? "Service",
        status: (d.status as string) ?? "pending",
        uptime30d: d.uptime30d as number | undefined,
        days: days.docs.map((x) => x.data() as DayDoc).reverse(),
      };
    })
  );

  const allUp = monitors.every((m) => m.status === "up");

  return (
    <main className="wrap">
      {/* Brand Header */}
      <header className="topbar">
        <div className="brand-badge">
          <span className="brand-robot">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2a2 2 0 0 1 2 2v1h1a3 3 0 0 1 3 3v2h1a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-1v4a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3v-4H5a2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2h1V8a3 3 0 0 1 3-3h1V4a2 2 0 0 1 2-2zM9 10a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm6 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm-6 6h6v-1.5H9V16z" />
            </svg>
          </span>
          <span>{page.title}</span>
        </div>
        <div className="row">
          <span className={`status-pill ${allUp ? "up" : "down"}`}>
            <span className={`status-dot ${allUp ? "up" : "down"}`} />
            {allUp ? "Operational" : "Degraded"}
          </span>
        </div>
      </header>

      {/* Main Status Hero */}
      <div
        className="card"
        style={{
          marginBottom: "24px",
          background: allUp
            ? "linear-gradient(135deg, rgba(59, 214, 113, 0.12) 0%, rgba(19, 27, 37, 0.95) 100%)"
            : "linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(19, 27, 37, 0.95) 100%)",
          border: allUp
            ? "1px solid rgba(59, 214, 113, 0.35)"
            : "1px solid rgba(239, 68, 68, 0.35)",
          padding: "24px",
        }}
      >
        <div className="row">
          <div className="status-dot-container">
            {allUp && <span className="pulse-ring up" />}
            {!allUp && <span className="pulse-ring down" />}
            <span className={`status-dot ${allUp ? "up" : "down"}`} />
          </div>
          <div>
            <h2 style={{ fontSize: "1.3rem", fontWeight: 700 }}>
              {allUp ? "All Systems Operational" : "Some Systems Are Experiencing Issues"}
            </h2>
            <p className="muted" style={{ marginTop: "4px" }}>
              {page.description || "Live real-time service health and historical incident uptime."}
            </p>
          </div>
        </div>
      </div>

      {/* Monitors List */}
      <div className="monitor-list">
        {monitors.map((m) => (
          <section key={m.id} className="card">
            <div className="row-between" style={{ marginBottom: "14px" }}>
              <div className="row">
                <span className={`status-dot ${m.status}`} />
                <strong style={{ fontSize: "1rem" }}>{m.name}</strong>
              </div>
              <div className="row">
                {m.uptime30d != null && (
                  <span className="dim font-mono">
                    {m.uptime30d.toFixed(2)}% uptime
                  </span>
                )}
                <span className={`status-pill ${m.status}`}>
                  {m.status}
                </span>
              </div>
            </div>

            <div className="bars-wrap">
              <div className="bars" aria-label="90 day history">
                {padDays(m.days, 90).map((d, i) => (
                  <span
                    key={i}
                    data-state={stateOf(d)}
                    title={d ? `${d.day}: ${(d.uptimeRatio * 100).toFixed(2)}%` : "No data"}
                  />
                ))}
              </div>
              <div className="row-between dim" style={{ marginTop: "6px", fontSize: "0.75rem" }}>
                <span>90 days ago</span>
                <span>Today</span>
              </div>
            </div>
          </section>
        ))}
      </div>

      <footer className="app-footer">
        <span>Powered by <strong>UptimeMonk</strong></span>
        <span>Updated real-time</span>
      </footer>
    </main>
  );
}

function padDays(days: DayDoc[], n: number): (DayDoc | null)[] {
  const out: (DayDoc | null)[] = Array(Math.max(0, n - days.length)).fill(null);
  return [...out, ...days];
}

function stateOf(d: DayDoc | null): string {
  if (!d) return "none";
  if (d.uptimeRatio >= 0.999) return "up";
  if (d.uptimeRatio >= 0.95) return "partial";
  return "down";
}
