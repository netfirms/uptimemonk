import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "UptimeMonk",
  description: "Uptime monitoring and status pages.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
