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
      <h1>{page.title}</h1>
      <p className="muted">{page.description}</p>

      <div className="card">
        <div className="row">
          <span className={`dot ${allUp ? "up" : "down"}`} />
          <strong>
            {allUp ? "All systems operational" : "Some systems are experiencing issues"}
          </strong>
        </div>
      </div>

      {monitors.map((m) => (
        <section key={m.id} className="card">
          <div className="row">
            <span className={`dot ${m.status}`} />
            <strong className="grow">{m.name}</strong>
            <span className="muted">
              {m.uptime30d != null ? `${m.uptime30d.toFixed(2)}% uptime` : ""}
            </span>
          </div>
          <div className="bars" aria-hidden="true">
            {padDays(m.days, 90).map((d, i) => (
              <span key={i} data-state={stateOf(d)} title={d ? `${d.day}` : undefined} />
            ))}
          </div>
          <div className="row muted" style={{ justifyContent: "space-between" }}>
            <span>90 days ago</span>
            <span>Today</span>
          </div>
        </section>
      ))}
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
