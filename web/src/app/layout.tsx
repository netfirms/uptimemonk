import type { Metadata, Viewport } from "next";
import "./globals.css";
import Analytics from "@/components/Analytics";

export const viewport: Viewport = {
  themeColor: "#090d16",
  colorScheme: "dark light",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL("https://www.uptimemonke.com"),
  title: {
    default: "UptimeMonke — High-Frequency Infrastructure Monitoring",
    template: "%s | UptimeMonke",
  },
  description:
    "High-frequency website and API uptime monitoring with sub-minute checks, SSL certificate expiry tracking, cron heartbeat pings, instant multi-channel alerts, and elegant public status pages. 100% free forever.",
  applicationName: "UptimeMonke",
  authors: [{ name: "UptimeMonke Team", url: "https://www.uptimemonke.com" }],
  creator: "UptimeMonke",
  publisher: "UptimeMonke",
  category: "technology",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/apple-icon.png",
  },
  alternates: {
    canonical: "https://www.uptimemonke.com",
  },
  openGraph: {
    title: "UptimeMonke — High-Frequency Infrastructure Monitoring",
    description:
      "High-frequency website & API monitoring with sub-minute checks, SSL tracking, cron heartbeat pings, and elegant public status pages.",
    url: "https://www.uptimemonke.com",
    siteName: "UptimeMonke",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "UptimeMonke — High-Frequency Infrastructure Monitoring",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "UptimeMonke — High-Frequency Infrastructure Monitoring",
    description:
      "High-frequency website & API monitoring with sub-minute checks, SSL tracking, cron heartbeat pings, and elegant public status pages.",
    images: ["/opengraph-image"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  keywords: [
    "uptime monitoring",
    "website monitoring",
    "api uptime monitor",
    "synthetic monitoring",
    "ssl certificate monitoring",
    "cron job heartbeat",
    "public status page",
    "ping monitoring",
    "port monitoring",
    "slack uptime alerts",
    "discord downtime alerts",
    "incident management",
    "free uptime robot alternative",
    "devops monitoring tools",
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        <link rel="icon" href="/favicon.ico" sizes="any" />
      </head>
      <body>
        <div className="ambient-glow" aria-hidden="true" />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
