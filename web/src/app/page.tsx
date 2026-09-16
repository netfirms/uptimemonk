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
  alternates: { canonical: "https://www.uptimemonke.com" },
};

/**
 * Structured data graph: SoftwareApplication, Organization, WebSite, and FAQPage.
 * Enables rich search snippets, FAQ accordions, and sitelink searchboxes.
 */
const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": "https://www.uptimemonke.com/#website",
      "url": "https://www.uptimemonke.com",
      "name": "UptimeMonke",
      "description": "High-frequency infrastructure uptime, SSL, and cron heartbeat monitoring.",
      "publisher": {
        "@id": "https://www.uptimemonke.com/#organization"
      }
    },
    {
      "@type": "Organization",
      "@id": "https://www.uptimemonke.com/#organization",
      "name": "UptimeMonke",
      "url": "https://www.uptimemonke.com",
      "logo": "https://www.uptimemonke.com/mascot-128.png",
      "sameAs": []
    },
    {
      "@type": "SoftwareApplication",
      "@id": "https://www.uptimemonke.com/#application",
      "name": "UptimeMonke",
      "applicationCategory": "DeveloperApplication",
      "operatingSystem": "Web",
      "url": "https://www.uptimemonke.com",
      "description":
        "High-frequency website & API monitoring with sub-minute checks, SSL certificate tracking, cron heartbeat pings, and elegant public status pages.",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD",
        "description": "Free tier with 14,400 checks every single day forever"
      },
      "featureList": [
        "HTTP and keyword uptime monitoring",
        "TCP port monitoring",
        "DNS record verification",
        "SSL certificate expiry alerts",
        "ICMP ping latency checks",
        "Cron heartbeat monitoring",
        "Multi-channel alerts (Slack, Discord, Email, Webhooks)",
        "Elegant public status pages with 90-day history bars"
      ]
    },
    {
      "@type": "FAQPage",
      "@id": "https://www.uptimemonke.com/#faq",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Is UptimeMonke really free? Do I need a credit card?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Yes! Every account receives 14,400 free checks every single day forever. No credit card is ever required. You can monitor 10 endpoints at 1-minute intervals or 50 endpoints at 5-minute intervals completely free."
          }
        },
        {
          "@type": "Question",
          "name": "How is UptimeMonke different from traditional tools like UptimeRobot?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Legacy monitoring services restrict free accounts to slow 5-minute check intervals and paywall critical features like SSL certificate expiry warnings and cron heartbeat monitoring behind monthly recurring subscriptions. UptimeMonke provides sub-minute intervals, SSL tracking, heartbeats, and public status pages on the free tier, supported by optional one-off $2.99 coffee donations instead of subscriptions."
          }
        },
        {
          "@type": "Question",
          "name": "Where are monitoring probes dispatched from?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Probes originate from hardened AWS Lightsail edge instances (currently in Singapore ap-southeast-1a). Our probe engine runs with HTTP keep-alive disabled to measure genuine first-packet connection times (DNS + TCP handshake + TLS) just like real visitors experience."
          }
        },
        {
          "@type": "Question",
          "name": "What happens if my workspace runs out of donated credit?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Your monitors are never paused or deleted. When your credit reaches zero, you enter a 7-day grace window at full service, after which your workspace smoothly transitions back to the 14,400 daily free allowance. Existing monitors continue checking uninterrupted."
          }
        },
        {
          "@type": "Question",
          "name": "Can I create a public status page for my clients or users?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Yes. Every workspace has an instantly shareable public status page at /status/:slug. It features real-time 90-day uptime bars, overall operational status, and automated incident logs with sensitive target URLs safely withheld."
          }
        }
      ]
    }
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
