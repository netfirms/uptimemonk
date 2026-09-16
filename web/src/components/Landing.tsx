"use client";

import { useState } from "react";
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { events } from "@/lib/analytics";

/**
 * The public marketing page.
 *
 * Lives at `/` rather than inside the dashboard because this is the only page
 * that should be indexed: `/dashboard` is the signed-in application, and a
 * crawler that lands there finds an app shell. Previously `/` rendered nothing
 * but "Loading dashboard…" and redirected here, which meant the site's own
 * root URL had no content for a search engine to read.
 *
 * A client component still has its first render emitted into the static HTML,
 * so the copy below is in the served markup and is indexable.
 */
export default function Landing({
  onSignedIn,
}: {
  onSignedIn?: () => void;
}) {
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);

  /**
   * Donating requires being signed in — always.
   *
   * The payment link carries no workspace of its own; the id has to be
   * appended as `client_reference_id`, and this page has no id to append. An
   * untagged donation is the worst outcome available: the money arrives, the
   * webhook has nothing to credit, and the donor gets no capacity and no
   * explanation. So sign-in comes first, and the tagged link is only ever
   * handed out by the API to an authenticated caller.
   *
   * It deliberately does not open Stripe automatically after sign-in. Being
   * redirected to a payment page you did not just ask for is alarming, so it
   * lands on the dashboard with the Support panel open instead.
   */
  async function handleDonate() {
    if (auth.currentUser) {
      window.location.href = "/dashboard?donate=1";
      return;
    }
    await handleGoogleSignIn("/dashboard?donate=1");
  }

  async function handleGoogleSignIn(next?: string) {
    setAuthError(null);
    setIsSigningIn(true);
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
      void events.signIn("google");
      if (next) {
        window.location.href = next;
        return;
      }
      onSignedIn?.();
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
        // The user closed it on purpose; not an error worth showing.
      } else if (code === "auth/popup-blocked") {
        setAuthError(
          "Your browser blocked the sign-in popup. Allow popups for this site and try again."
        );
      } else if (code === "auth/unauthorized-domain") {
        setAuthError("This domain is not authorised for sign-in yet.");
      } else {
        setAuthError((err as Error)?.message || "Could not sign in with Google.");
      }
    } finally {
      setIsSigningIn(false);
    }
  }

  return (
      <main className="wrap">
        {/* Minimal Navigation Bar */}
        <header className="topbar">
          <div className="brand-badge">
            <span className="brand-robot">
              {/* The mascot, not an inline glyph — a brand mark should be
                  the brand mark. 128px source for retina at 20-28px. */}
              <img src="/mascot-128.png" alt="UptimeMonke" width={56} height={56} />
            </span>
            <span>UptimeMonke</span>
          </div>

          <div className="row">
            <span className="status-pill up" style={{ fontSize: "0.72rem" }}>
              <span className="status-dot up" />
              Probes Live
            </span>
            <button className="primary" onClick={() => handleGoogleSignIn()} disabled={isSigningIn}>
              {isSigningIn ? "Connecting…" : "Sign In with Google"}
            </button>
          </div>
        </header>

        {/* Lightweight Hero */}
        <section className="hero-wrap">
          <div className="hero-tag">
            <span className="status-dot up" />
            Free Website &amp; Infrastructure Monitoring
          </div>
          <h1 className="hero-title">
            Keep your websites &amp; APIs online.
          </h1>
          <p className="hero-desc">
            Continuous HTTP, SSL, ping, and cron heartbeat monitoring with sub-minute checks and instant alerts before your users notice.
          </p>

          {/* Direct CTA */}
          <div className="hero-cta-wrap">
            {authError && (
              <div
                style={{
                  background: "rgba(239, 68, 68, 0.12)",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  borderRadius: "8px",
                  padding: "10px 14px",
                  color: "#ef4444",
                  fontSize: "0.85rem",
                  maxWidth: "400px",
                  textAlign: "center",
                }}
              >
                {authError}
              </div>
            )}

            <button className="google-btn-light" onClick={() => handleGoogleSignIn()} disabled={isSigningIn}>
              {isSigningIn ? (
                <span>Connecting to Google…</span>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                    />
                  </svg>
                  <span>Continue with Google</span>
                </>
              )}
            </button>
            <p className="dim" style={{ fontSize: "0.78rem" }}>
              Free forever · No credit card · No feature locked behind a plan
            </p>
          </div>

          {/* Horizontal Feature Badges */}
          <div className="features-strip">
            <div className="feature-pill">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3BD671" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10 15 15 0 0 1 4-10z" />
              </svg>
              <span>Website &amp; API (HTTP)</span>
            </div>
            <div className="feature-pill">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3BD671" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
              </svg>
              <span>SSL Expiry Alerts</span>
            </div>
            <div className="feature-pill">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3BD671" strokeWidth="2">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
              <span>Ping (ICMP)</span>
            </div>
            <div className="feature-pill">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3BD671" strokeWidth="2">
                <rect width="18" height="18" x="3" y="3" rx="2" />
              </svg>
              <span>Port &amp; DNS Checks</span>
            </div>
            <div className="feature-pill">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3BD671" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span>Cron Heartbeats</span>
            </div>
            <div className="feature-pill">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3BD671" strokeWidth="2">
                <rect width="18" height="18" x="3" y="3" rx="2" />
                <path d="M7 8h10" />
                <path d="M7 12h10" />
              </svg>
              <span>Public Status Pages</span>
            </div>
          </div>

          {/* Compact Live Check Preview */}
          <div className="preview-box">
            <div className="preview-topbar">
              <div className="preview-dots">
                <span className="preview-dot-mac" />
                <span className="preview-dot-mac" />
                <span className="preview-dot-mac" />
              </div>
              <span>Live Edge Probes — Active Checks</span>
              <span className="status-dot up" />
            </div>
            <div className="preview-rows">
              <div className="preview-row">
                <div className="row">
                  <span className="status-dot up" />
                  <span className="preview-target">https://api.example.com/health</span>
                </div>
                <div className="row">
                  <span className="dim">200 OK</span>
                  <span className="latency-val latency-fast">28 ms</span>
                </div>
              </div>
              <div className="preview-row">
                <div className="row">
                  <span className="status-dot up" />
                  <span className="preview-target">https://example.com</span>
                </div>
                <div className="row">
                  <span className="dim">SSL Valid (82d)</span>
                  <span className="latency-val latency-fast">44 ms</span>
                </div>
              </div>
              <div className="preview-row">
                <div className="row">
                  <span className="status-dot up" />
                  <span className="preview-target">db.internal:5432</span>
                </div>
                <div className="row">
                  <span className="dim">TCP Open</span>
                  <span className="latency-val latency-fast">12 ms</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How it is paid for */}
        <section className="donate-strip" id="support">
          <h2>There is no paid plan</h2>
          <p className="donate-lede">
            Every feature works on a free account — every check type, sub-minute
            intervals, status pages, alerting, the API. What a donation pays for
            is <strong>capacity</strong>, because that is the only part that
            actually costs money: each check is a real request from a real
            machine.
          </p>

          <div className="donate-grid">
            <div className="donate-card">
              <span className="donate-label">Free, forever</span>
              <strong className="donate-figure">14,400</strong>
              <span className="dim">checks a day</span>
              <p className="dim">
                Ten monitors at one minute. Or fifty at five minutes. Or one at
                six seconds — it is the same load, so it is the same price.
              </p>
            </div>

            <div className="donate-card accent">
              <span className="donate-label">One $2.99 coffee adds</span>
              <strong className="donate-figure">8.97M</strong>
              <span className="dim">checks</span>
              <p className="dim">
                About two hundred monitors at one minute, for a month. Unused
                capacity rolls over, and there is no subscription — it is a
                one-off, buy another whenever you like.
              </p>
              <button
                type="button"
                className="coffee-btn"
                style={{ marginTop: 14 }}
                onClick={handleDonate}
                disabled={isSigningIn}
              >
                <span aria-hidden>☕</span>
                {isSigningIn ? "Signing in…" : "Buy me a coffee"}
              </button>
              <p className="dim" style={{ marginTop: 8, fontSize: "0.72rem" }}>
                Sign-in first, so the capacity lands on your workspace rather
                than disappearing.
              </p>
            </div>

            <div className="donate-card">
              <span className="donate-label">If you stop</span>
              <strong className="donate-figure">Nothing</strong>
              <span className="dim">is deleted</span>
              <p className="dim">
                A week of grace at full capacity, then back to the free
                allowance. Your monitors keep checking throughout.
              </p>
            </div>
          </div>

          <p className="donate-why">
            Why checks and not monitors? A five-second check is twelve times the
            work of a one-minute one. Charging per monitor would price those the
            same — and it would stop a free account running a single fast check
            that costs no more than ten slow ones.
          </p>
        </section>

        {/* Minimal Footer */}
        <footer className="app-footer">
          <span>UptimeMonke · Lightweight Infrastructure Monitoring</span>
          <span>v{process.env.NEXT_PUBLIC_APP_VERSION ?? "0.1.0"}</span>
        </footer>
      </main>
    );
}
