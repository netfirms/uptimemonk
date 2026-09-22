"use client";

import { useEffect } from "react";

/**
 * Route-level error boundary.
 *
 * Without this, a render error in the dashboard leaves a blank page — the
 * worst possible outcome for a monitoring product, because it looks exactly
 * like the product being down.
 *
 * Deliberately says the probes are unaffected, which is true: checks run on
 * the worker and do not depend on this page rendering. Someone who sees this
 * screen needs to know whether their monitoring stopped. It did not.
 *
 * No i18n, no shared components, no data fetching. An error page that depends
 * on the thing that just broke is not an error page.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard render error:", error);
  }, [error]);

  return (
    <main className="wrap">
      <div
        style={{
          maxWidth: "520px",
          margin: "12vh auto",
          padding: "28px",
          background: "var(--surface-card, rgba(26,34,45,0.84))",
          border: "1px solid var(--border, #16323f)",
          borderRadius: "14px",
        }}
      >
        <h1 style={{ fontSize: "1.35rem", margin: "0 0 10px", letterSpacing: "-0.02em" }}>
          This page hit an error
        </h1>
        <p
          style={{
            margin: "0 0 18px",
            fontSize: "0.92rem",
            lineHeight: 1.6,
            color: "var(--text-muted, #93a7b4)",
          }}
        >
          Your monitors are unaffected — checks run on our workers, not in this
          page, and alerts are still being delivered. This is the dashboard
          failing to draw, nothing more.
        </p>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button className="primary" onClick={reset}>
            Try again
          </button>
          {/* Inline, not a class: `.btn-secondary` does not exist in this
              stylesheet, and an error page is the last place to rely on a
              class being there. */}
          <a
            href="/dashboard"
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "10px 18px",
              borderRadius: "8px",
              border: "1px solid var(--border, #16323f)",
              color: "var(--text, #f8fafc)",
              textDecoration: "none",
              fontSize: "0.9rem",
              fontWeight: 600,
            }}
          >
            Reload the dashboard
          </a>
        </div>

        {error.digest && (
          <p
            style={{
              marginTop: "18px",
              fontSize: "0.72rem",
              fontFamily: "var(--font-mono, monospace)",
              color: "var(--text-dim, #7d909e)",
            }}
          >
            Reference: {error.digest}
          </p>
        )}
      </div>
    </main>
  );
}
