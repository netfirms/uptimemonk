import type { Metadata } from "next";
import Landing from "@/components/Landing";

/**
 * The public, indexable page.
 *
 * This used to render "Loading dashboard…" and client-redirect to /dashboard,
 * which left the site's own root URL with no content for a crawler — while the
 * marketing copy sat behind a URL that should not be indexed at all.
 */
export const metadata: Metadata = {
  alternates: { canonical: "https://uptimemonke.com" },
};

/**
 * Structured data: only facts that are true and visible on the page. Inventing
 * ratings or prices here is the quickest route to a manual penalty.
 */
const structuredData = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "UptimeMonke",
  "applicationCategory": "DeveloperApplication",
  "operatingSystem": "Web",
  "url": "https://uptimemonke.com",
  "description": "Real-time uptime monitoring, SSL expiry tracking, cron heartbeat pings and public status pages.",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "USD",
    "description": "Free plan with 5-minute checks"
  },
  "featureList": [
    "HTTP and keyword monitoring",
    "TCP port monitoring",
    "DNS record monitoring",
    "SSL certificate expiry alerts",
    "ICMP ping monitoring",
    "Cron heartbeat monitoring",
    "Public status pages"
  ]
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        // Static, developer-authored JSON — no user input reaches this.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <Landing />
    </>
  );
}
