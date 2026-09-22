"use client";

import { useEffect } from "react";

/**
 * Error boundary for the ops console.
 *
 * The console is where an operator goes *because* something looks wrong, so a
 * blank page here is worse than elsewhere: it removes the tool being reached
 * for. Styles are inline and literal — the console's stylesheet may be part
 * of what failed, and a fallback that needs it is not a fallback.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Admin console render error:", error);
  }, [error]);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0b0f16",
        color: "#e7ebf0",
        fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        padding: "24px",
      }}
    >
      <div style={{ maxWidth: "500px" }}>
        <p style={{ margin: 0, fontFamily: "ui-monospace, monospace", fontSize: "0.74rem", color: "#7c838f" }}>
          OPS CONSOLE
        </p>
        <h1 style={{ fontSize: "1.3rem", margin: "6px 0 10px", letterSpacing: "-0.02em" }}>
          The console hit an error
        </h1>
        <p style={{ margin: "0 0 18px", fontSize: "0.92rem", lineHeight: 1.6, color: "#a3aab5" }}>
          The fleet is unaffected — this is the console failing to draw, not the
          workers. Probes, alerts and the API carry on without it.
        </p>
        <p style={{ margin: "0 0 18px", fontSize: "0.86rem", lineHeight: 1.6, color: "#a3aab5" }}>
          To check the fleet directly:{" "}
          <code style={{ fontFamily: "ui-monospace, monospace", color: "#e7ebf0" }}>
            curl -s https://api.uptimemonke.com/healthz
          </code>
        </p>
        <button
          onClick={reset}
          style={{
            background: "#3bd671",
            color: "#08151f",
            border: "none",
            borderRadius: "8px",
            padding: "10px 18px",
            fontSize: "0.9rem",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Try again
        </button>
        {error.digest && (
          <p style={{ marginTop: "18px", fontSize: "0.72rem", color: "#7c838f" }}>
            Reference: {error.digest}
          </p>
        )}
      </div>
    </main>
  );
}
