import type { Metadata } from "next";
import StatusPageClient from "./StatusPageClient";

/**
 * Public status page.
 *
 * Client-rendered against the worker's public API, which is a deliberate
 * reversal of how this started. It used to render on the server through the
 * Admin SDK, which needs a Node runtime — and this site is a static export on
 * Firebase Hosting's free tier, where there isn't one. The old version quietly
 * fell through the SPA rewrite and served the landing page for every real
 * slug, and it read a `monitors/{id}/days` subcollection that stopped existing
 * when history moved to SQLite. It was broken twice over.
 *
 * One shell is prerendered and a hosting rewrite points `/status/**` at it;
 * the slug is read from the URL at runtime. That costs server-rendered content
 * for crawlers, which is the honest trade for staying on Spark — the metadata
 * below still gives a link preview a title, and the data itself is live rather
 * than a minute stale.
 */
export const dynamicParams = false;

export function generateStaticParams() {
  // The single prerendered shell every slug is rewritten onto.
  return [{ slug: "_shell" }];
}

export const metadata: Metadata = {
  title: "Service status",
  description: "Live uptime and incident history.",
  // A status page is about one customer's services, not ours — there is
  // nothing here we want ranking against the marketing site.
  robots: { index: false, follow: false },
};

export default function StatusPage() {
  return <StatusPageClient />;
}
