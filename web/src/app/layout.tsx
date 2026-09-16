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
  metadataBase: new URL("https://uptimemonke.com"),
  title: "UptimeMonke — High-Frequency Infrastructure Monitoring",
  description: "Real-time uptime monitoring, SSL tracking, heartbeat pings, and elegant public status pages.",
  // Icons come from the app/icon.png and app/apple-icon.png file conventions.
  // public/favicon.ico still serves the bare /favicon.ico path that browsers
  // and crawlers request regardless of the link tags.
  alternates: {
    canonical: "https://uptimemonke.com",
  },
  openGraph: {
    title: "UptimeMonke — High-Frequency Infrastructure Monitoring",
    description: "Real-time uptime monitoring, SSL tracking, heartbeat pings, and elegant public status pages.",
    url: "https://uptimemonke.com",
    siteName: "UptimeMonke",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "UptimeMonke — high-frequency infrastructure monitoring",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "UptimeMonke — High-Frequency Infrastructure Monitoring",
    description:
      "Real-time uptime monitoring, SSL tracking, heartbeat pings, and elegant public status pages.",
    images: ["/opengraph-image"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  applicationName: "UptimeMonke",
  keywords: [
    "uptime monitoring",
    "website monitoring",
    "status page",
    "ssl expiry monitoring",
    "cron heartbeat monitoring",
    "ping monitoring",
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
      </head>
      <body>
        <div className="ambient-glow" aria-hidden="true" />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
