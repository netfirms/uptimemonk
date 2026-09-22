import Link from "next/link";

/**
 * 404.
 *
 * Next ships a default, but it is an unstyled "This page could not be found"
 * on a white background — which on a dark product reads as a broken deploy
 * rather than a wrong URL.
 */
export default function NotFound() {
  return (
    <main className="wrap">
      <div
        style={{
          maxWidth: "520px",
          margin: "12vh auto",
          padding: "28px",
          background: "var(--surface-card, rgba(26,34,45,0.84))",
          border: "1px solid var(--border, #2b3441)",
          borderRadius: "14px",
        }}
      >
        <p
          style={{
            margin: 0,
            fontFamily: "var(--font-mono, monospace)",
            fontSize: "0.78rem",
            color: "var(--text-dim, #7c838f)",
          }}
        >
          404
        </p>
        <h1 style={{ fontSize: "1.35rem", margin: "6px 0 10px", letterSpacing: "-0.02em" }}>
          No page at this address
        </h1>
        <p
          style={{
            margin: "0 0 18px",
            fontSize: "0.92rem",
            lineHeight: 1.6,
            color: "var(--text-muted, #a3aab5)",
          }}
        >
          If you were looking for a public status page, check the address with
          whoever shared it — those live at <code>/status/&lt;name&gt;</code>.
        </p>
        <Link className="primary" href="/">
          Go to the homepage
        </Link>
      </div>
    </main>
  );
}
