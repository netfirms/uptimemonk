import { ImageResponse } from "next/og";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * `output: export` requires route handlers to declare themselves static, or
 * the build refuses to emit them.
 */
export const dynamic = "force-static";


/**
 * The social card, rendered to a PNG at build time.
 *
 * Generated rather than a checked-in image so the wording stays in one place
 * with the rest of the metadata. Uses only system fonts and flat colour: a
 * remote font fetch would be one more thing that can fail a build for a
 * picture.
 */
export const alt = "UptimeMonke — high-frequency infrastructure monitoring";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const mascot = `data:image/png;base64,${readFileSync(
  join(process.cwd(), "public", "mascot-128.png")
).toString("base64")}`;

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#070b10",
          padding: "72px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {/* Read from disk and inlined: this renders at build time, when
              there is no server to fetch an absolute URL from. */}
          <img src={mascot} width={84} height={84} alt="" />
          <div style={{ color: "#ffffff", fontSize: 36, fontWeight: 700 }}>UptimeMonke</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Satori requires an explicit display on any element with more
              than one child, so the two lines are separate flex rows rather
              than one string with a <br />. */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              color: "#ffffff",
              fontSize: 68,
              fontWeight: 800,
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
            }}
          >
            <div style={{ display: "flex" }}>Know before your</div>
            <div style={{ display: "flex" }}>customers do.</div>
          </div>
          <div style={{ display: "flex", color: "#94a3b8", fontSize: 30, lineHeight: 1.35 }}>
            Uptime, SSL expiry, cron heartbeats and public status pages.
          </div>
        </div>

        {/* The signature object of this category: a run of status ticks. */}
        <div style={{ display: "flex", gap: 6 }}>
          {Array.from({ length: 48 }).map((_, i) => (
            <div
              key={i}
              style={{
                width: 16,
                height: 34,
                borderRadius: 3,
                background: i === 29 ? "#ef4444" : i === 14 ? "#f59e0b" : "#6fc3df",
              }}
            />
          ))}
        </div>
      </div>
    ),
    size
  );
}
