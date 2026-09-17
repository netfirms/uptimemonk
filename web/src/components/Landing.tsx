"use client";

import { useState, useEffect } from "react";
import {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { events } from "@/lib/analytics";
import EmailAuth from "./EmailAuth";
import AuthModal from "./AuthModal";

/**
 * Public marketing landing page for UptimeMonke.
 *
 * Implements Phase 1 and Phase 2 enhancements:
 * - Ambient dark glowing aesthetic with developer grid pattern
 * - Sticky navigation bar with anchor links
 * - Interactive Live Edge Probes sandbox with real-time animated ping pulses and uptime bars
 * - Multi-channel alert showcase (Slack, Discord, Email, Webhook)
 * - Why UptimeMonke 4-feature grid
 * - Transparent capacity pricing with coffee donation
 * - Semantic, accessible FAQ accordion (<details name="faq">)
 * - Frictionless bottom Google Sign-in conversion banner
 */
export default function Landing({
  onSignedIn,
}: {
  onSignedIn?: (user?: User) => void;
}) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<"signup" | "signin">("signup");
  const [quickUrl, setQuickUrl] = useState("");
  /** Google stays the one-click path; email is a disclosure beneath it. */
  const [showEmailAuth, setShowEmailAuth] = useState(false);

  // Interactive Live Edge Probes Tab
  const [demoTab, setDemoTab] = useState<"http" | "ssl" | "ports" | "heartbeat">("http");

  // Simulated live latency jitter (18ms - 32ms) to give a breathing, active pulse
  const [simulatedJitter, setSimulatedJitter] = useState({
    api: 24,
    auth: 46,
    store: 31,
  });

  // Alert Channel Tab
  const [alertTab, setAlertTab] = useState<"slack" | "discord" | "email" | "webhook">("slack");

  // Auth listener and redirect handler
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setCurrentUser(u);
      if (u && onSignedIn) {
        onSignedIn(u);
      }
    });

    getRedirectResult(auth)
      .then((res) => {
        if (res?.user) {
          void events.signIn("google");
          if (onSignedIn) {
            onSignedIn(res.user);
          } else {
            window.location.href = "/dashboard";
          }
        }
      })
      .catch((err) => {
        console.error("Redirect sign-in error:", err);
      });

    return () => unsub();
  }, [onSignedIn]);

  // Pulse jitter effect every 3.5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setSimulatedJitter({
        api: 20 + Math.floor(Math.random() * 8),
        auth: 42 + Math.floor(Math.random() * 10),
        store: 28 + Math.floor(Math.random() * 7),
      });
    }, 3500);
    return () => clearInterval(timer);
  }, []);

  async function handleDonate() {
    if (auth.currentUser) {
      window.location.href = "/dashboard?donate=1";
      return;
    }
    await handleGoogleSignIn("/dashboard?donate=1");
  }

  async function handleGoogleSignIn(next: string = "/dashboard") {
    setAuthError(null);
    setIsSigningIn(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const res = await signInWithPopup(auth, provider);
      void events.signIn("google");
      if (onSignedIn) {
        onSignedIn(res.user);
      } else {
        window.location.href = next;
      }
    } catch (err: unknown) {
      console.error("Sign-in error:", err);
      const code = (err as { code?: string })?.code;
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
        // User closed popup deliberately
      } else if (code === "auth/popup-blocked" || code === "auth/unauthorized-domain") {
        try {
          const provider = new GoogleAuthProvider();
          provider.setCustomParameters({ prompt: "select_account" });
          await signInWithRedirect(auth, provider);
          return;
        } catch (redirectErr) {
          setAuthError(
            (redirectErr as Error)?.message || "Sign-in popup was blocked. Please allow popups or try again."
          );
        }
      } else {
        setAuthError((err as Error)?.message || "Could not sign in with Google.");
      }
    } finally {
      setIsSigningIn(false);
    }
  }

  return (
    <main className="wrap landing-page">
      {/* 1. STICKY TOP NAVIGATION BAR */}
      <header className="topbar landing-topbar">
        <div className="brand-badge">
          <span className="brand-robot">
            <img src="/mascot-128.png" alt="UptimeMonke" width={56} height={56} />
          </span>
          <span className="brand-title">UptimeMonke</span>
        </div>

        {/* Navigation Anchor Links */}
        <nav className="landing-nav" aria-label="Main Navigation">
          <a href="#features" className="landing-nav-link">Features</a>
          <a href="#demo" className="landing-nav-link">Live Demo</a>
          <a href="#alerts" className="landing-nav-link">Alerts</a>
          <a href="#pricing" className="landing-nav-link">Pricing</a>
          <a href="#faq" className="landing-nav-link">FAQ</a>
        </nav>

        <div className="row" style={{ gap: "10px" }}>
          <span className="status-pill up" style={{ fontSize: "0.74rem" }} title="Global edge workers active">
            <span className="status-dot up pulse" />
            Probes Live
          </span>
          {currentUser ? (
            <a
              href="/dashboard"
              className="primary"
              style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              <span>Dashboard</span>
              <span>→</span>
            </a>
          ) : (
            <div className="row" style={{ gap: "8px" }}>
              <button
                type="button"
                className="btn-topbar-login"
                onClick={() => {
                  setAuthModalMode("signin");
                  setAuthModalOpen(true);
                }}
              >
                Log In
              </button>
              <button
                type="button"
                className="primary"
                onClick={() => {
                  setAuthModalMode("signup");
                  setAuthModalOpen(true);
                }}
              >
                Start Free
              </button>
            </div>
          )}
        </div>
      </header>

      {/* 2. HERO SECTION */}
      <section className="hero-wrap" id="hero">
        <div className="hero-glow-backdrop" aria-hidden="true" />

        <div className="hero-tag">
          <span className="status-dot up pulse" />
          <span>Sub-Minute Edge Checks · 100% Free Forever</span>
        </div>

        <h1 className="hero-title">
          Keep your websites &amp; APIs <span className="hero-green">online</span>.
        </h1>

        <p className="hero-desc">
          Continuous HTTP, SSL expiry, TCP ping, and cron heartbeat monitoring with sub-minute checks and instant multi-channel alerts before your users notice downtime.
        </p>

        {/* Interactive Quickstart Form */}
        <div className="hero-quickstart-container">
          {authError && (
            <div className="hero-auth-error" role="alert" style={{ marginBottom: "16px" }}>
              {authError}
            </div>
          )}

          <form
            className="hero-quickstart-form"
            onSubmit={(e) => {
              e.preventDefault();
              let target = quickUrl.trim();
              if (!target) {
                setAuthModalMode("signup");
                setAuthModalOpen(true);
                return;
              }
              if (!target.startsWith("http://") && !target.startsWith("https://")) {
                target = "https://" + target;
              }
              if (currentUser) {
                window.location.href = `/dashboard?new=${encodeURIComponent(target)}`;
              } else {
                setAuthModalMode("signup");
                setAuthModalOpen(true);
              }
            }}
          >
            <div className="hero-quickstart-bar">
              <span className="hero-quickstart-icon">🌐</span>
              <input
                type="text"
                className="hero-quickstart-input"
                placeholder="Enter your website or API (e.g. example.com)"
                value={quickUrl}
                onChange={(e) => setQuickUrl(e.target.value)}
                aria-label="Enter your website URL to monitor"
              />
              <button type="submit" className="hero-quickstart-btn">
                <span>Start Monitoring</span>
                <span className="arrow-icon">→</span>
              </button>
            </div>
          </form>

          {/* Social / Direct Auth Options */}
          <div className="hero-social-strip">
            <button
              type="button"
              className="google-btn-light"
              onClick={() => {
                const target = quickUrl.trim()
                  ? (quickUrl.trim().startsWith("http") ? quickUrl.trim() : "https://" + quickUrl.trim())
                  : "";
                handleGoogleSignIn(target ? `/dashboard?new=${encodeURIComponent(target)}` : "/dashboard");
              }}
              disabled={isSigningIn}
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z" />
                <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z" />
                <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z" />
                <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z" />
              </svg>
              <span>{isSigningIn ? "Connecting…" : "Continue with Google"}</span>
            </button>

            <button
              type="button"
              className="hero-email-btn"
              onClick={() => {
                setAuthModalMode("signup");
                setAuthModalOpen(true);
              }}
            >
              <span>✉️ Sign up with Email</span>
            </button>
          </div>

          <div className="hero-feature-tags">
            <span>⚡ 60s Check Intervals</span>
            <span>•</span>
            <span>🔒 Free SSL Expiry Alerts</span>
            <span>•</span>
            <span>🚫 No Credit Card Required</span>
          </div>
        </div>

        {/* Feature Badges Strip */}
        <div className="features-strip">
          <div className="feature-pill">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3BD671" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4 10 15 15 0 0 1 4-10z" />
            </svg>
            <span>HTTP(S) &amp; APIs</span>
          </div>
          <div className="feature-pill">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3BD671" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
            </svg>
            <span>SSL Expiry (30d/14d/7d)</span>
          </div>
          <div className="feature-pill">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3BD671" strokeWidth="2">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
            <span>Ping (ICMP) &amp; TCP</span>
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
              <path d="M7 8h10M7 12h10" />
            </svg>
            <span>Public Status Pages</span>
          </div>
        </div>
      </section>

      {/* 3. INTERACTIVE "LIVE EDGE PROBES" SANDBOX */}
      <section className="demo-section" id="demo">
        <div className="section-head">
          <span className="section-tag">Interactive Sandbox</span>
          <h2>See How UptimeMonke Probes Your Stack</h2>
          <p className="dim">Real-time edge probes dispatched from AWS Lightsail Singapore with sub-minute resolution.</p>
        </div>

        <div className="preview-box preview-box-interactive">
          {/* Tab bar inside preview */}
          <div className="preview-nav-tabs">
            <button
              type="button"
              className={`preview-tab-btn ${demoTab === "http" ? "active" : ""}`}
              onClick={() => setDemoTab("http")}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10 15 15 0 0 1 4-10z" />
              </svg>
              <span>HTTP &amp; APIs</span>
            </button>
            <button
              type="button"
              className={`preview-tab-btn ${demoTab === "ssl" ? "active" : ""}`}
              onClick={() => setDemoTab("ssl")}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
              </svg>
              <span>SSL Certificates</span>
            </button>
            <button
              type="button"
              className={`preview-tab-btn ${demoTab === "ports" ? "active" : ""}`}
              onClick={() => setDemoTab("ports")}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect width="18" height="18" x="3" y="3" rx="2" />
                <path d="M8 12h8" />
              </svg>
              <span>TCP &amp; DNS</span>
            </button>
            <button
              type="button"
              className={`preview-tab-btn ${demoTab === "heartbeat" ? "active" : ""}`}
              onClick={() => setDemoTab("heartbeat")}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span>Cron Heartbeats</span>
            </button>
          </div>

          <div className="preview-topbar">
            <div className="preview-dots">
              <span className="preview-dot-mac" />
              <span className="preview-dot-mac" />
              <span className="preview-dot-mac" />
            </div>
            <div className="row" style={{ gap: "8px" }}>
              <span className="dim" style={{ fontSize: "0.72rem" }}>Worker: sg-1 (ap-southeast-1a)</span>
              <span className="status-dot up pulse" />
            </div>
          </div>

          {/* Dynamic Tab Content */}
          <div className="preview-rows">
            {demoTab === "http" && (
              <>
                <div className="preview-row">
                  <div className="preview-info-col">
                    <div className="row" style={{ gap: "8px" }}>
                      <span className="status-dot up pulse" />
                      <strong className="preview-target">https://api.uptimemonke.com/healthz</strong>
                    </div>
                    {/* Simulated 30-day mini uptime bar */}
                    <div className="uptime-spark-row" title="30-Day Uptime: 99.99%">
                      {Array.from({ length: 30 }).map((_, i) => (
                        <span key={i} className="spark-bar up" />
                      ))}
                    </div>
                  </div>
                  <div className="preview-meta-col">
                    <span className="badge-code-200">200 OK</span>
                    <span className="latency-val latency-fast">{simulatedJitter.api} ms</span>
                  </div>
                </div>

                <div className="preview-row">
                  <div className="preview-info-col">
                    <div className="row" style={{ gap: "8px" }}>
                      <span className="status-dot up pulse" />
                      <strong className="preview-target">https://auth.acme-corp.dev/oauth/token</strong>
                    </div>
                    <div className="uptime-spark-row" title="30-Day Uptime: 100.00%">
                      {Array.from({ length: 30 }).map((_, i) => (
                        <span key={i} className="spark-bar up" />
                      ))}
                    </div>
                  </div>
                  <div className="preview-meta-col">
                    <span className="badge-code-200">200 OK</span>
                    <span className="latency-val latency-fast">{simulatedJitter.auth} ms</span>
                  </div>
                </div>

                <div className="preview-row">
                  <div className="preview-info-col">
                    <div className="row" style={{ gap: "8px" }}>
                      <span className="status-dot up pulse" />
                      <strong className="preview-target">https://checkout.mystore.io/api/v1/pay</strong>
                    </div>
                    <div className="uptime-spark-row" title="30-Day Uptime: 99.98%">
                      {Array.from({ length: 30 }).map((_, i) => (
                        <span key={i} className={`spark-bar ${i === 18 ? "warn" : "up"}`} />
                      ))}
                    </div>
                  </div>
                  <div className="preview-meta-col">
                    <span className="badge-code-200">200 OK</span>
                    <span className="latency-val latency-fast">{simulatedJitter.store} ms</span>
                  </div>
                </div>
              </>
            )}

            {demoTab === "ssl" && (
              <>
                <div className="preview-row">
                  <div className="preview-info-col">
                    <div className="row" style={{ gap: "8px" }}>
                      <span className="status-dot up" />
                      <strong className="preview-target">api.uptimemonke.com</strong>
                    </div>
                    <span className="dim" style={{ fontSize: "0.75rem" }}>Issuer: Let's Encrypt · TLS 1.3 · SNI Verified</span>
                  </div>
                  <div className="preview-meta-col">
                    <span className="ssl-badge valid">Valid (84 days)</span>
                  </div>
                </div>

                <div className="preview-row">
                  <div className="preview-info-col">
                    <div className="row" style={{ gap: "8px" }}>
                      <span className="status-dot up" />
                      <strong className="preview-target">payments.acme-corp.dev</strong>
                    </div>
                    <span className="dim" style={{ fontSize: "0.75rem" }}>Issuer: DigiCert Global G2 · Monitored daily</span>
                  </div>
                  <div className="preview-meta-col">
                    <span className="ssl-badge valid">Valid (29 days)</span>
                  </div>
                </div>

                <div className="preview-row">
                  <div className="preview-info-col">
                    <div className="row" style={{ gap: "8px" }}>
                      <span className="status-dot warn" />
                      <strong className="preview-target">legacy-portal.internal</strong>
                    </div>
                    <span className="dim" style={{ fontSize: "0.75rem" }}>Alert queued to Slack &amp; Email on day 7</span>
                  </div>
                  <div className="preview-meta-col">
                    <span className="ssl-badge alert">Expiring in 4 days</span>
                  </div>
                </div>
              </>
            )}

            {demoTab === "ports" && (
              <>
                <div className="preview-row">
                  <div className="preview-info-col">
                    <div className="row" style={{ gap: "8px" }}>
                      <span className="status-dot up pulse" />
                      <strong className="preview-target">db-primary.prod:5432</strong>
                    </div>
                    <span className="dim" style={{ fontSize: "0.75rem" }}>Protocol: TCP Socket Connection</span>
                  </div>
                  <div className="preview-meta-col">
                    <span className="badge-code-200">PORT OPEN</span>
                    <span className="latency-val latency-fast">14 ms</span>
                  </div>
                </div>

                <div className="preview-row">
                  <div className="preview-info-col">
                    <div className="row" style={{ gap: "8px" }}>
                      <span className="status-dot up pulse" />
                      <strong className="preview-target">redis-cache.prod:6379</strong>
                    </div>
                    <span className="dim" style={{ fontSize: "0.75rem" }}>Protocol: TCP Handshake Probe</span>
                  </div>
                  <div className="preview-meta-col">
                    <span className="badge-code-200">PORT OPEN</span>
                    <span className="latency-val latency-fast">9 ms</span>
                  </div>
                </div>

                <div className="preview-row">
                  <div className="preview-info-col">
                    <div className="row" style={{ gap: "8px" }}>
                      <span className="status-dot up" />
                      <strong className="preview-target">dns.google (8.8.8.8)</strong>
                    </div>
                    <span className="dim" style={{ fontSize: "0.75rem" }}>Query: A Record Resolution</span>
                  </div>
                  <div className="preview-meta-col">
                    <span className="badge-code-200">RESOLVED</span>
                    <span className="latency-val latency-fast">6 ms</span>
                  </div>
                </div>
              </>
            )}

            {demoTab === "heartbeat" && (
              <>
                <div className="preview-row">
                  <div className="preview-info-col">
                    <div className="row" style={{ gap: "8px" }}>
                      <span className="status-dot up pulse" />
                      <strong className="preview-target">nightly-postgres-backup.sh</strong>
                    </div>
                    <span className="dim" style={{ fontSize: "0.75rem" }}>Last ping: 4m ago · Expected interval: 24h · Grace: 30m</span>
                  </div>
                  <div className="preview-meta-col">
                    <span className="badge-code-200">HEALTHY</span>
                  </div>
                </div>

                <div className="preview-row">
                  <div className="preview-info-col">
                    <div className="row" style={{ gap: "8px" }}>
                      <span className="status-dot up pulse" />
                      <strong className="preview-target">stripe-settlement-sync</strong>
                    </div>
                    <span className="dim" style={{ fontSize: "0.75rem" }}>Last ping: 19s ago · Expected interval: 1h · Grace: 5m</span>
                  </div>
                  <div className="preview-meta-col">
                    <span className="badge-code-200">HEALTHY</span>
                  </div>
                </div>

                {/* Command snippet */}
                <div className="heartbeat-snippet-row">
                  <span className="dim" style={{ fontSize: "0.74rem" }}>Simple cron integration:</span>
                  <code className="heartbeat-code">
                    0 3 * * * /scripts/backup.sh &amp;&amp; curl -fsS -m 10 https://api.uptimemonke.com/heartbeat/{`{token}`}
                  </code>
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {/* 4. MULTI-CHANNEL ALERT SHOWCASE */}
      <section className="alerts-section" id="alerts">
        <div className="section-head">
          <span className="section-tag">Instant Incident Notification</span>
          <h2>Alert Your Team Before Customers Complain</h2>
          <p className="dim">Zero-delay alert dispatch across the tools your engineering team already lives in.</p>
        </div>

        {/* Channel Selector */}
        <div className="channel-tabs">
          <button
            type="button"
            className={`channel-tab-btn ${alertTab === "slack" ? "active" : ""}`}
            onClick={() => setAlertTab("slack")}
          >
            <span>Slack</span>
          </button>
          <button
            type="button"
            className={`channel-tab-btn ${alertTab === "discord" ? "active" : ""}`}
            onClick={() => setAlertTab("discord")}
          >
            <span>Discord</span>
          </button>
          <button
            type="button"
            className={`channel-tab-btn ${alertTab === "email" ? "active" : ""}`}
            onClick={() => setAlertTab("email")}
          >
            <span>Mailgun Email</span>
          </button>
          <button
            type="button"
            className={`channel-tab-btn ${alertTab === "webhook" ? "active" : ""}`}
            onClick={() => setAlertTab("webhook")}
          >
            <span>Webhook (JSON)</span>
          </button>
        </div>

        {/* Alert Card Mockup */}
        <div className="alert-mockup-wrapper">
          {alertTab === "slack" && (
            <div className="slack-mockup">
              <div className="slack-header">
                <span className="slack-hash">#</span>
                <span className="slack-chan">incidents-production</span>
              </div>
              <div className="slack-message incident">
                <div className="slack-avatar">
                  <img src="/mascot-128.png" alt="UptimeMonke" width={36} height={36} />
                </div>
                <div className="slack-content">
                  <div className="slack-meta">
                    <strong>UptimeMonke APP</strong>
                    <span className="slack-badge">BOT</span>
                    <span className="dim">14:02</span>
                  </div>
                  <div className="slack-attachment danger">
                    <p className="slack-alert-title">🚨 <strong>Production API is DOWN</strong></p>
                    <p className="dim" style={{ fontSize: "0.82rem", margin: "4px 0" }}>
                      Target: <code>https://api.acme-corp.dev/healthz</code>
                    </p>
                    <p style={{ color: "#ef4444", fontSize: "0.82rem" }}>
                      Reason: HTTP 502 Bad Gateway (Response time: 10,024 ms)
                    </p>
                  </div>
                </div>
              </div>

              <div className="slack-message recovery" style={{ marginTop: "14px" }}>
                <div className="slack-avatar">
                  <img src="/mascot-128.png" alt="UptimeMonke" width={36} height={36} />
                </div>
                <div className="slack-content">
                  <div className="slack-meta">
                    <strong>UptimeMonke APP</strong>
                    <span className="slack-badge">BOT</span>
                    <span className="dim">14:04 (2m later)</span>
                  </div>
                  <div className="slack-attachment success">
                    <p className="slack-alert-title">✅ <strong>Production API has RECOVERED</strong></p>
                    <p className="dim" style={{ fontSize: "0.82rem", margin: "4px 0" }}>
                      Target: <code>https://api.acme-corp.dev/healthz</code>
                    </p>
                    <p style={{ color: "#3BD671", fontSize: "0.82rem" }}>
                      Status: 200 OK (32 ms) · Incident closed. Downtime duration: 2m 14s.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {alertTab === "discord" && (
            <div className="discord-mockup">
              <div className="discord-meta">
                <div className="discord-avatar">
                  <img src="/mascot-128.png" alt="UptimeMonke" width={34} height={34} />
                </div>
                <strong>UptimeMonke</strong>
                <span className="discord-bot-tag">BOT</span>
                <span className="dim" style={{ fontSize: "0.75rem" }}>Today at 14:02</span>
              </div>
              <div className="discord-embed">
                <div className="discord-embed-bar" />
                <div className="discord-embed-content">
                  <h4 style={{ color: "#ef4444", margin: "0 0 6px 0" }}>[ALERT] Monitor DOWN: checkout-service</h4>
                  <p className="dim" style={{ fontSize: "0.82rem" }}>
                    HTTP status code <strong>500 Internal Server Error</strong> returned from Singapore edge worker.
                  </p>
                  <div className="discord-fields">
                    <div className="discord-field">
                      <span className="dim">URL</span>
                      <code>https://checkout.mystore.io/pay</code>
                    </div>
                    <div className="discord-field">
                      <span className="dim">Trigger</span>
                      <span>2 consecutive failures</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {alertTab === "email" && (
            <div className="email-mockup">
              <div className="email-top">
                <div>
                  <span className="dim">From:</span> <strong>UptimeMonke Alerts &lt;alerts@mg.uptimemonke.com&gt;</strong>
                </div>
                <div>
                  <span className="dim">Subject:</span> <strong>[INCIDENT] Your monitor &quot;Stripe Webhook Gateway&quot; is DOWN</strong>
                </div>
              </div>
              <div className="email-body">
                <div className="email-banner danger">
                  <span>CRITICAL INCIDENT DETECTED</span>
                </div>
                <h3 style={{ margin: "14px 0 8px" }}>Monitor is unresponsive</h3>
                <p className="dim" style={{ fontSize: "0.85rem", lineHeight: 1.6 }}>
                  Your endpoint <code>https://api.mystore.io/webhooks/stripe</code> did not respond within the 10-second timeout threshold.
                </p>
                <div className="email-cta">
                  <span className="btn-fake">View Live Status Page</span>
                </div>
              </div>
            </div>
          )}

          {alertTab === "webhook" && (
            <div className="code-mockup">
              <div className="code-header">
                <span>POST /v1/incoming-webhook (200 OK)</span>
                <span className="dim">application/json</span>
              </div>
              <pre className="json-pre">
{`{
  "event": "incident.opened",
  "monitor": {
    "id": "mon_09b2e3",
    "name": "Checkout API",
    "target": "https://api.mystore.io/checkout",
    "type": "http",
    "status": "down"
  },
  "incident": {
    "startedAt": 1789542120000,
    "error": "HTTP 502 Bad Gateway",
    "region": "ap-southeast-1a"
  }
}`}
              </pre>
            </div>
          )}
        </div>
      </section>

      {/* 5. WHY UPTIMEMONKE / FEATURES GRID */}
      <section className="features-grid-section" id="features">
        <div className="section-head">
          <span className="section-tag">Engineered for Developers</span>
          <h2>Why Teams Choose UptimeMonke</h2>
          <p className="dim">No artificial paywalls, no bloated enterprise contracts. Just fast, dependable infrastructure monitoring.</p>
        </div>

        <div className="why-grid">
          <div className="why-card">
            <div className="why-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3BD671" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <h3>Sub-Minute Edge Checks</h3>
            <p className="dim">
              Traditional monitoring platforms lock free accounts to 5-minute intervals. UptimeMonke lets you run sub-minute checks right out of the box so you know about failures instantly.
            </p>
          </div>

          <div className="why-card">
            <div className="why-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3BD671" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
              </svg>
            </div>
            <h3>SSRF-Hardened Cloud Fleet</h3>
            <p className="dim">
              Engineered with strict RFC1918 link-local defense, AWS IMDSv2 metadata attack prevention, and DNS rebinding guards. Safe for corporate internal targets.
            </p>
          </div>

          <div className="why-card">
            <div className="why-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3BD671" strokeWidth="2">
                <rect width="18" height="18" x="3" y="3" rx="2" />
                <path d="M7 8h10M7 12h10" />
              </svg>
            </div>
            <h3>Branded Public Status Pages</h3>
            <p className="dim">
              Publish a clean status page at <code>/status/:slug</code> with 90-day historical uptime bars and active incident feeds. Keeps your customers informed during outages.
            </p>
          </div>

          <div className="why-card">
            <div className="why-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3BD671" strokeWidth="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            </div>
            <h3>Multi-Channel Alerts</h3>
            <p className="dim">
              Deliver alerts to Slack, Discord, Telegram, custom Webhooks, and Mailgun emails with zero configuration pain. Verified contacts prevent alert spoofing.
            </p>
          </div>
        </div>
      </section>

      {/* 6. TRANSPARENT CAPACITY PRICING */}
      <section className="donate-strip" id="pricing">
        <div className="section-head">
          <span className="section-tag">Zero Subscriptions</span>
          <h2>There Is No Paid Plan</h2>
          <p className="donate-lede">
            Every single feature works on a free account — all check types, sub-minute intervals, public status pages, and alerting. What an optional donation pays for is <strong>capacity</strong>, because that is the only part that costs real server resources.
          </p>
        </div>

        <div className="donate-grid">
          <div className="donate-card">
            <span className="donate-label">Free, forever</span>
            <strong className="donate-figure">14,400</strong>
            <span className="dim">checks a day</span>
            <p className="dim">
              Ten monitors at one minute. Or fifty at five minutes. Or one at six seconds — it is the exact same compute load, so it is the exact same free price.
            </p>
          </div>

          <div className="donate-card accent">
            <span className="donate-label">One $2.99 coffee adds</span>
            <strong className="donate-figure">897,000</strong>
            <span className="dim">checks</span>
            <p className="dim">
              Around a month of twenty monitors at one minute, or ten at thirty seconds. Unused capacity rolls over with zero subscriptions — buy another whenever you run low.
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
              Sign-in first, so capacity lands on your workspace rather than disappearing.
            </p>
          </div>

          <div className="donate-card">
            <span className="donate-label">If credit runs out</span>
            <strong className="donate-figure">Nothing</strong>
            <span className="dim">is deleted</span>
            <p className="dim">
              A week of grace at full capacity, then a seamless fallback to the free 14,400 daily allowance. Your monitors keep running throughout.
            </p>
          </div>
        </div>

        <p className="donate-why">
          Why checks and not monitors? A five-second check is twelve times the work of a one-minute one. Charging per monitor would price those the same — and it would stop a free account running a single fast check that costs no more than ten slow ones.
        </p>
      </section>

      {/* 7. SEMANTIC ACCESSIBLE FAQ ACCORDION */}
      <section className="faq-section" id="faq">
        <div className="section-head">
          <span className="section-tag">Frequently Asked Questions</span>
          <h2>Everything You Need to Know</h2>
          <p className="dim">Honest answers to common developer questions about UptimeMonke.</p>
        </div>

        <div className="faq-accordion-wrap">
          <details name="faq" className="faq-item" open>
            <summary className="faq-summary">
              <span>Is UptimeMonke really free? Do I need a credit card?</span>
              <span className="faq-chevron" aria-hidden="true">▾</span>
            </summary>
            <div className="faq-content">
              <p>
                Yes! Every account receives <strong>14,400 free checks every single day</strong> forever. No credit card is ever required. You can monitor 10 endpoints at 1-minute intervals or 50 endpoints at 5-minute intervals completely free.
              </p>
            </div>
          </details>

          <details name="faq" className="faq-item">
            <summary className="faq-summary">
              <span>How is UptimeMonke different from traditional tools like UptimeRobot?</span>
              <span className="faq-chevron" aria-hidden="true">▾</span>
            </summary>
            <div className="faq-content">
              <p>
                Legacy monitoring services restrict free accounts to slow 5-minute check intervals and paywall critical features like SSL certificate expiry warnings and cron heartbeat monitoring behind monthly recurring subscriptions. UptimeMonke provides sub-minute intervals, SSL tracking, heartbeats, and public status pages on the free tier, supported by optional one-off $2.99 coffee donations instead of subscriptions.
              </p>
            </div>
          </details>

          <details name="faq" className="faq-item">
            <summary className="faq-summary">
              <span>Where are monitoring probes dispatched from?</span>
              <span className="faq-chevron" aria-hidden="true">▾</span>
            </summary>
            <div className="faq-content">
              <p>
                Probes originate from hardened AWS Lightsail edge instances (currently in Singapore <code>ap-southeast-1a</code>). Our probe engine runs with HTTP keep-alive disabled to measure genuine first-packet connection times (DNS + TCP handshake + TLS) just like real visitors experience.
              </p>
            </div>
          </details>

          <details name="faq" className="faq-item">
            <summary className="faq-summary">
              <span>What happens if my workspace runs out of donated credit?</span>
              <span className="faq-chevron" aria-hidden="true">▾</span>
            </summary>
            <div className="faq-content">
              <p>
                Your monitors are <strong>never paused or deleted</strong>. When your credit reaches zero, you enter a 7-day grace window at full service, after which your workspace smoothly transitions back to the 14,400 daily free allowance. Existing monitors continue checking uninterrupted.
              </p>
            </div>
          </details>

          <details name="faq" className="faq-item">
            <summary className="faq-summary">
              <span>Can I create a public status page for my clients or users?</span>
              <span className="faq-chevron" aria-hidden="true">▾</span>
            </summary>
            <div className="faq-content">
              <p>
                Yes. Every workspace has an instantly shareable public status page at <code>/status/:slug</code>. It features real-time 90-day uptime bars, overall operational status, and automated incident logs with sensitive target URLs safely withheld.
              </p>
            </div>
          </details>
        </div>
      </section>

      {/* 8. FRICTIONLESS BOTTOM CONVERSION BANNER */}
      <section className="cta-banner">
        <div className="cta-banner-content">
          <div className="cta-tag">Get Started Today</div>
          <h2>Ready to eliminate undetected downtime?</h2>
          <p className="dim">
            Join developers keeping their critical web applications and APIs online. Setup takes under 30 seconds.
          </p>
          {currentUser ? (
            <a
              href="/dashboard"
              className="primary"
              style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "8px", padding: "12px 28px", fontSize: "1rem" }}
            >
              <span>Go to Dashboard</span>
              <span>→</span>
            </a>
          ) : (
            <div className="row" style={{ gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
              <button
                type="button"
                className="google-btn-light"
                onClick={() => handleGoogleSignIn()}
                disabled={isSigningIn}
              >
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
                <span>{isSigningIn ? "Connecting…" : "Continue with Google"}</span>
              </button>

              <button
                type="button"
                className="primary"
                style={{ padding: "12px 28px", fontSize: "1rem" }}
                onClick={() => {
                  setAuthModalMode("signup");
                  setAuthModalOpen(true);
                }}
              >
                <span>Start Free Monitoring →</span>
              </button>
            </div>
          )}
          <span className="dim" style={{ fontSize: "0.78rem" }}>
            14,400 free checks every day · No credit card required · Instant setup
          </span>
        </div>
      </section>

      {/* 9. MINIMAL FOOTER */}
      <footer className="app-footer">
        <div className="row" style={{ gap: "10px" }}>
          <span>UptimeMonke · Lightweight Infrastructure Monitoring</span>
        </div>
        <div className="row" style={{ gap: "16px" }}>
          <a href="#hero" className="dim" style={{ fontSize: "0.8rem", textDecoration: "none" }}>Back to top ↑</a>
          <span>v{process.env.NEXT_PUBLIC_APP_VERSION ?? "0.1.0"}</span>
        </div>
      </footer>

      {/* Modern Accessible Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode={authModalMode}
        targetUrl={
          quickUrl.trim()
            ? quickUrl.trim().startsWith("http")
              ? quickUrl.trim()
              : "https://" + quickUrl.trim()
            : undefined
        }
        onSignedIn={(u) => {
          if (onSignedIn) {
            onSignedIn(u);
          } else {
            const target = quickUrl.trim()
              ? quickUrl.trim().startsWith("http")
                ? quickUrl.trim()
                : "https://" + quickUrl.trim()
              : "";
            window.location.href = target ? `/dashboard?new=${encodeURIComponent(target)}` : "/dashboard";
          }
        }}
      />
    </main>
  );
}
