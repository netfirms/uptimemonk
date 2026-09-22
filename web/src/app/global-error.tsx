"use client";

/**
 * Last resort: an error thrown by the root layout itself.
 *
 * This replaces the layout, so `globals.css` is not loaded and no CSS
 * variable exists — every style here is inline and literal on purpose. A
 * fallback that relies on the stylesheet the broken layout was supposed to
 * import would render unstyled, which is how a crash turns into a page that
 * looks like a parked domain.
 *
 * It must also supply its own <html> and <body>.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#111822",
          color: "#f8fafc",
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          padding: "24px",
        }}
      >
        <div style={{ maxWidth: "460px" }}>
          <h1 style={{ fontSize: "1.3rem", margin: "0 0 10px", letterSpacing: "-0.02em" }}>
            UptimeMonke could not start
          </h1>
          <p style={{ margin: "0 0 18px", fontSize: "0.92rem", lineHeight: 1.6, color: "#a3aab5" }}>
            Your monitors are unaffected — checks run on our workers and alerts
            are still going out. This is the web app failing to load.
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
      </body>
    </html>
  );
}
