"use client";

import { useState, useEffect } from "react";
import {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  GithubAuthProvider,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { events } from "@/lib/analytics";
import AuthModal from "./AuthModal";
import LanguagePicker from "./LanguagePicker";
import { useI18n } from "@/lib/i18n/context";
import Reveal from "./Reveal";
import LatencyChart from "./LatencyChart";

/**
 * Public marketing landing page for UptimeMonke.
 *
 * Implements multi-locale i18n support (English, Japanese, Korean, Malay, Indonesian, Burmese):
 * - Ambient dark glowing aesthetic with developer grid pattern
 * - Sticky navigation bar with anchor links & language picker
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
  const { t } = useI18n();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isGithubSigningIn, setIsGithubSigningIn] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<"signup" | "signin">("signup");
  const [quickUrl, setQuickUrl] = useState("");
  const [selectedPreset, setSelectedPreset] = useState<"ai" | "web" | "ssl" | "heartbeat">("ai");

  // Interactive Live Edge Probes Tab
  const [demoTab, setDemoTab] = useState<"ai" | "http" | "ssl" | "ports" | "heartbeat">("ai");

  // Simulated live latency jitter to give a breathing, active pulse
  const [simulatedJitter, setSimulatedJitter] = useState({
    ai: 360,
    api: 24,
    auth: 46,
    store: 31,
  });

  function getDestination(target: string, preset: "ai" | "web" | "ssl" | "heartbeat") {
    const p = new URLSearchParams();
    let finalTarget = target.trim();
    if (!finalTarget) {
      finalTarget =
        preset === "ai"
          ? "https://api.myapp.ai/v1/chat/completions"
          : preset === "ssl"
          ? "myapp.com"
          : preset === "heartbeat"
          ? "nightly-ai-worker"
          : "https://myapp.com";
    }
    if (preset !== "ssl" && preset !== "heartbeat") {
      if (!finalTarget.startsWith("http://") && !finalTarget.startsWith("https://")) {
        finalTarget = "https://" + finalTarget;
      }
    }
    p.set("new", finalTarget);
    if (preset === "ai") {
      p.set("type", "http");
      p.set("name", "AI Inference API");
    } else if (preset === "ssl") {
      p.set("type", "ssl");
      p.set("name", `${finalTarget} SSL`);
    } else if (preset === "heartbeat") {
      p.set("type", "heartbeat");
      p.set("name", finalTarget);
    } else {
      p.set("type", "http");
      p.set("name", "Production Web App");
    }
    return `/dashboard?${p.toString()}`;
  }

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
        ai: 340 + Math.floor(Math.random() * 50),
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

  /**
   * GitHub sign-in.
   *
   * Mirrors the Google path, including the popup-then-redirect fallback:
   * a popup is the better experience, but browsers block it often enough
   * that falling back rather than erroring is what makes it reliable.
   */
  async function handleGithubSignIn(next: string = "/dashboard") {
    setAuthError(null);
    setIsGithubSigningIn(true);
    try {
      const provider = new GithubAuthProvider();
      provider.addScope("read:user");
      provider.addScope("user:email");
      const res = await signInWithPopup(auth, provider);
      void events.signIn("github");
      if (onSignedIn) {
        onSignedIn(res.user);
      } else {
        window.location.href = next;
      }
    } catch (err: unknown) {
      console.error("GitHub sign-in error:", err);
      const code = (err as { code?: string })?.code;
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
        // Closed deliberately — not an error worth showing.
      } else if (code === "auth/popup-blocked" || code === "auth/unauthorized-domain") {
        try {
          const provider = new GithubAuthProvider();
          provider.addScope("read:user");
          provider.addScope("user:email");
          await signInWithRedirect(auth, provider);
          return;
        } catch (redirectErr) {
          setAuthError(
            (redirectErr as Error)?.message || "Sign-in popup was blocked. Please allow popups or try again."
          );
        }
      } else {
        setAuthError((err as Error)?.message || "Could not sign in with GitHub.");
      }
    } finally {
      setIsGithubSigningIn(false);
    }
  }

  return (
    <main className="wrap landing-page">
      {/* 1. STICKY TOP NAVIGATION BAR */}
      <header className="topbar landing-topbar glass">
        <div className="brand-badge">
          <span className="brand-robot">
            <img src="/mascot-128.png" alt="UptimeMonke" width={56} height={56} />
          </span>
          <span className="brand-title">UptimeMonke</span>
        </div>

        {/* Navigation Anchor Links */}
        <nav className="landing-nav" aria-label="Main Navigation">
          <a href="#features" className="landing-nav-link">{t("navFeatures")}</a>
          <a href="#demo" className="landing-nav-link">{t("navDemo")}</a>
          <a href="#alerts" className="landing-nav-link">{t("navAlerts")}</a>
          <a href="#pricing" className="landing-nav-link">{t("navPricing")}</a>
          <a href="#faq" className="landing-nav-link">{t("navFaq")}</a>
        </nav>

        <div className="row" style={{ gap: "10px", alignItems: "center" }}>
          {/* Language Picker Dropdown */}
          <LanguagePicker />

          <span className="status-pill up" style={{ fontSize: "0.74rem" }} title="Global edge workers active">
            <span className="status-dot up pulse" />
            {t("probesLive")}
          </span>
          {currentUser ? (
            <a
              href="/dashboard"
              className="primary"
              style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              <span>{t("dashboardBtn")}</span>
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
                {t("logIn")}
              </button>
              <button
                type="button"
                className="primary"
                onClick={() => {
                  setAuthModalMode("signup");
                  setAuthModalOpen(true);
                }}
              >
                {t("startFree")}
              </button>
            </div>
          )}
        </div>
      </header>      {/* 2. HERO SECTION */}
      <section className="hero-wrap" id="hero">
        <div className="hero-glow-backdrop" aria-hidden="true" />

        <div className="hero-ai-pill">
          <span className="status-dot up pulse" />
          <span>{t("heroAiBadge")}</span>
        </div>

        <h1 className="hero-title">
          <span className="hero-gradient-text">{t("heroAiHeadline")}</span>
        </h1>

        <p className="hero-desc">
          {t("heroAiSubtext")}
        </p>

        {/* Interactive Quickstart Form */}
        <div className="hero-quickstart-container glass-strong">
          {authError && (
            <div className="hero-auth-error" role="alert" style={{ marginBottom: "16px" }}>
              {authError}
            </div>
          )}

          <form
            className="hero-quickstart-form"
            onSubmit={(e) => {
              e.preventDefault();
              const dest = getDestination(quickUrl, selectedPreset);
              if (currentUser) {
                window.location.href = dest;
              } else {
                setAuthModalMode("signup");
                setAuthModalOpen(true);
              }
            }}
          >
            <div className="hero-quickstart-bar">
              <span className="hero-quickstart-icon">
                {selectedPreset === "ai" ? "🤖" : selectedPreset === "ssl" ? "🔒" : selectedPreset === "heartbeat" ? "⚡" : "🌐"}
              </span>
              <input
                type="text"
                className="hero-quickstart-input"
                placeholder={
                  selectedPreset === "ai"
                    ? "https://api.myapp.ai/v1/chat/completions"
                    : selectedPreset === "ssl"
                    ? "myapp.com"
                    : selectedPreset === "heartbeat"
                    ? "nightly-ai-worker"
                    : t("heroPlaceholder")
                }
                value={quickUrl}
                onChange={(e) => setQuickUrl(e.target.value)}
                aria-label={t("heroPlaceholder")}
              />
              <button type="submit" className="hero-quickstart-btn">
                <span>{t("heroStartBtn")}</span>
                <span className="arrow-icon">→</span>
              </button>
            </div>

            {/* Quickstart Workload Presets */}
            <div className="hero-presets-strip">
              <button
                type="button"
                className={`hero-preset-btn ${selectedPreset === "ai" ? "active" : ""}`}
                onClick={() => {
                  setSelectedPreset("ai");
                  setQuickUrl("https://api.myapp.ai/v1/chat/completions");
                }}
              >
                <span>{t("presetAiApi")}</span>
              </button>
              <button
                type="button"
                className={`hero-preset-btn ${selectedPreset === "web" ? "active" : ""}`}
                onClick={() => {
                  setSelectedPreset("web");
                  setQuickUrl("https://myapp.com");
                }}
              >
                <span>{t("presetWebApp")}</span>
              </button>
              <button
                type="button"
                className={`hero-preset-btn ${selectedPreset === "ssl" ? "active" : ""}`}
                onClick={() => {
                  setSelectedPreset("ssl");
                  setQuickUrl("myapp.com");
                }}
              >
                <span>{t("presetSsl")}</span>
              </button>
              <button
                type="button"
                className={`hero-preset-btn ${selectedPreset === "heartbeat" ? "active" : ""}`}
                onClick={() => {
                  setSelectedPreset("heartbeat");
                  setQuickUrl("nightly-ai-worker");
                }}
              >
                <span>{t("presetHeartbeat")}</span>
              </button>
            </div>
          </form>

          {/* Social / Direct Auth Options */}
          <div className="hero-social-strip">
            <button
              type="button"
              className="google-btn-light"
              onClick={() => {
                handleGoogleSignIn(getDestination(quickUrl, selectedPreset));
              }}
              disabled={isSigningIn || isGithubSigningIn}
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z" />
                <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z" />
                <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z" />
                <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z" />
              </svg>
              <span>{isSigningIn ? t("heroConnecting") : t("continueWithGoogle")}</span>
            </button>

            <button
              type="button"
              className="github-btn-dark"
              onClick={() => {
                handleGithubSignIn(getDestination(quickUrl, selectedPreset));
              }}
              disabled={isSigningIn || isGithubSigningIn}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="currentColor" d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
              <span>{isGithubSigningIn ? t("heroConnecting") : t("continueWithGithub")}</span>
            </button>

            <button
              type="button"
              className="hero-email-btn"
              onClick={() => {
                setAuthModalMode("signup");
                setAuthModalOpen(true);
              }}
            >
              <span>✉️ {t("signUpWithEmail")}</span>
            </button>
          </div>

          {/* The pills below already say HTTP/SSL/cron — repeating them here
              made eight feature mentions stack under the CTA. Only the trust
              signal, which the pills do not carry, stays. */}
          <div className="hero-feature-tags">
            <span>{t("featureNoCard")}</span>
          </div>
        </div>

        {/* Feature Badges Strip */}
        <div className="features-strip">
          <div className="feature-pill">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3BD671" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10 15 15 0 0 1 4-10z" />
            </svg>
            <span>{t("pillHttp")}</span>
          </div>
          <div className="feature-pill">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3BD671" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
            </svg>
            <span>{t("pillSsl")}</span>
          </div>
          <div className="feature-pill">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3BD671" strokeWidth="2">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
            <span>{t("pillPing")}</span>
          </div>
          <div className="feature-pill">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3BD671" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span>{t("pillCron")}</span>
          </div>
          <div className="feature-pill">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3BD671" strokeWidth="2">
              <rect width="18" height="18" x="3" y="3" rx="2" />
              <path d="M7 8h10M7 12h10" />
            </svg>
            <span>{t("pillStatusPage")}</span>
          </div>
        </div>

        {/* Who this is for. Named explicitly, because "monitoring" means
            something different to an SRE than to someone shipping a weekend
            app, and the page has to tell them it is for both. */}
        <Reveal className="audience-band" delay={120} rootMargin="0px 0px 14% 0px">
          <span className="audience-tag">{t("audienceTag")}</span>
          <div className="audience-roles">
            <span className="audience-role">{t("audienceDataEng")}</span>
            <span className="audience-role">{t("audienceDevOps")}</span>
            <span className="audience-role">{t("audienceSre")}</span>
            <span className="audience-role">{t("audienceVibe")}</span>
          </div>
        </Reveal>
      </section>

      {/* 2.5. ONBOARDING JOURNEY SECTION */}
      <section className="onboarding-journey-section">
        <div className="section-head" style={{ marginBottom: "8px" }}>
          <span className="section-tag">{t("onboardingJourneyTag")}</span>
          <h2>{t("onboardingJourneyTitle")}</h2>
        </div>
        <Reveal as="div" className="journey-cards-grid" stagger>
          <div className="journey-card">
            <div className="journey-badge">1</div>
            <h3>{t("onboardingStep1")}</h3>
            <p>{t("onboardingStep1Desc")}</p>
          </div>
          <div className="journey-card">
            <div className="journey-badge">2</div>
            <h3>{t("onboardingStep2")}</h3>
            <p>{t("onboardingStep2Desc")}</p>
          </div>
          <div className="journey-card">
            <div className="journey-badge">3</div>
            <h3>{t("onboardingStep3")}</h3>
            <p>{t("onboardingStep3Desc")}</p>
          </div>
        </Reveal>
      </section>

      {/* 3. INTERACTIVE "LIVE EDGE PROBES" SANDBOX */}
      <section className="demo-section" id="demo">
        <Reveal className="section-head">
          <span className="section-tag">{t("demoTag")}</span>
          <h2>{t("demoTitle")}</h2>
          <p className="dim">{t("demoDesc")}</p>
        </Reveal>

        <div className="preview-box preview-box-interactive glass">
          {/* Tab bar inside preview */}
          <div className="preview-nav-tabs">
            <button
              type="button"
              className={`preview-tab-btn ${demoTab === "ai" ? "active" : ""}`}
              onClick={() => setDemoTab("ai")}
            >
              <span>🤖</span>
              <span>{t("tabAi")}</span>
            </button>
            <button
              type="button"
              className={`preview-tab-btn ${demoTab === "http" ? "active" : ""}`}
              onClick={() => setDemoTab("http")}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10 15 15 0 0 1 4-10z" />
              </svg>
              <span>{t("tabHttp")}</span>
            </button>
            <button
              type="button"
              className={`preview-tab-btn ${demoTab === "ssl" ? "active" : ""}`}
              onClick={() => setDemoTab("ssl")}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
              </svg>
              <span>{t("tabSsl")}</span>
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
              <span>{t("tabPorts")}</span>
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
              <span>{t("tabHeartbeat")}</span>
            </button>
          </div>

          <div className="preview-topbar">
            <div className="preview-dots">
              <span className="preview-dot-mac" />
              <span className="preview-dot-mac" />
              <span className="preview-dot-mac" />
            </div>
            <div className="row" style={{ gap: "8px" }}>
              <span className="dim" style={{ fontSize: "0.72rem" }}>{t("demoWorkerLocation")}</span>
              <span className="status-dot up pulse" />
            </div>
          </div>

          {/* Dynamic Tab Content */}
          <div className="preview-rows">
            {demoTab === "ai" && (
              <>
                <div className="preview-row">
                  <div className="preview-info-col">
                    <div className="row" style={{ gap: "8px" }}>
                      <span className="status-dot up pulse" />
                      <strong className="preview-target">https://api.myapp.ai/v1/chat/completions</strong>
                    </div>
                    <div className="uptime-spark-row" title={t("demoUptime30d")}>
                      {Array.from({ length: 30 }).map((_, i) => (
                        <span key={i} className="spark-bar up" />
                      ))}
                    </div>
                  </div>
                  <div className="preview-meta-col">
                    <span className="badge-code-200">200 OK</span>
                    <span className="latency-val latency-fast">{simulatedJitter.ai} ms</span>
                  </div>
                </div>

                <div className="preview-row">
                  <div className="preview-info-col">
                    <div className="row" style={{ gap: "8px" }}>
                      <span className="status-dot up pulse" />
                      <strong className="preview-target">https://gateway.internal.ai/v1/models</strong>
                    </div>
                    <span className="dim" style={{ fontSize: "0.75rem" }}>OpenAI &amp; Claude LLM Proxy Gateway</span>
                  </div>
                  <div className="preview-meta-col">
                    <span className="badge-code-200">200 OK</span>
                    <span className="latency-val latency-fast">42 ms</span>
                  </div>
                </div>

                <div className="preview-row">
                  <div className="preview-info-col">
                    <div className="row" style={{ gap: "8px" }}>
                      <span className="status-dot up pulse" />
                      <strong className="preview-target">vector-db-qdrant.prod:6333</strong>
                    </div>
                    <span className="dim" style={{ fontSize: "0.75rem" }}>Vector Database Latency &amp; Embeddings Health</span>
                  </div>
                  <div className="preview-meta-col">
                    <span className="badge-code-200">{t("demoPortOpen")}</span>
                    <span className="latency-val latency-fast">18 ms</span>
                  </div>
                </div>
              </>
            )}
            {demoTab === "http" && (
              <>
                <div className="preview-row">
                  <div className="preview-info-col">
                    <div className="row" style={{ gap: "8px" }}>
                      <span className="status-dot up pulse" />
                      <strong className="preview-target">https://api.uptimemonke.com/healthz</strong>
                    </div>
                    <div className="uptime-spark-row" title={t("demoUptime30d")}>
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
                    <div className="uptime-spark-row" title={t("demoUptime30d")}>
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
                    <div className="uptime-spark-row" title={t("demoUptime30d")}>
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
                    <span className="dim" style={{ fontSize: "0.75rem" }}>Issuer: Let&apos;s Encrypt · TLS 1.3 · SNI Verified</span>
                  </div>
                  <div className="preview-meta-col">
                    <span className="ssl-badge valid">{t("demoSslValid")}</span>
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
                    <span className="ssl-badge valid">{t("demoSslValid")}</span>
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
                    <span className="ssl-badge alert">{t("demoSslExpiring")}</span>
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
                    <span className="badge-code-200">{t("demoPortOpen")}</span>
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
                    <span className="badge-code-200">{t("demoPortOpen")}</span>
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
                    <span className="badge-code-200">{t("demoResolved")}</span>
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
                    <span className="dim" style={{ fontSize: "0.75rem" }}>{t("demoLastPing")}</span>
                  </div>
                  <div className="preview-meta-col">
                    <span className="badge-code-200">{t("demoHealthy")}</span>
                  </div>
                </div>

                <div className="preview-row">
                  <div className="preview-info-col">
                    <div className="row" style={{ gap: "8px" }}>
                      <span className="status-dot up pulse" />
                      <strong className="preview-target">stripe-settlement-sync</strong>
                    </div>
                    <span className="dim" style={{ fontSize: "0.75rem" }}>{t("demoLastPing")}</span>
                  </div>
                  <div className="preview-meta-col">
                    <span className="badge-code-200">{t("demoHealthy")}</span>
                  </div>
                </div>

                {/* Command snippet */}
                <div className="heartbeat-snippet-row">
                  <span className="dim" style={{ fontSize: "0.74rem" }}>{t("demoCronSnippet")}</span>
                  <code className="heartbeat-code">
                    0 3 * * * /scripts/backup.sh &amp;&amp; curl -fsS -m 10 https://api.uptimemonke.com/heartbeat/{`{token}`}
                  </code>
                </div>
              </>
            )}
          </div>
          <div className="preview-chart-slot">
            <LatencyChart title={t("demoChartTitle")} />
          </div>
        </div>
      </section>

      {/* 4. MULTI-CHANNEL ALERT SHOWCASE */}
      <section className="alerts-section" id="alerts">
        <Reveal className="section-head">
          <span className="section-tag">{t("alertsTag")}</span>
          <h2>{t("alertsTitle")}</h2>
          <p className="dim">{t("alertsDesc")}</p>
        </Reveal>

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
                    <p className="slack-alert-title">🚨 <strong>{t("alertDownTitle")}</strong></p>
                    <p className="dim" style={{ fontSize: "0.82rem", margin: "4px 0" }}>
                      Target: <code>https://api.acme-corp.dev/healthz</code>
                    </p>
                    <p style={{ color: "#ef4444", fontSize: "0.82rem" }}>
                      {t("alertReason")}
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
                    <span className="dim">14:04</span>
                  </div>
                  <div className="slack-attachment success">
                    <p className="slack-alert-title">✅ <strong>{t("alertRecoveredTitle")}</strong></p>
                    <p className="dim" style={{ fontSize: "0.82rem", margin: "4px 0" }}>
                      Target: <code>https://api.acme-corp.dev/healthz</code>
                    </p>
                    <p style={{ color: "#3BD671", fontSize: "0.82rem" }}>
                      {t("alertClosed")}
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
                  <h4 style={{ color: "#ef4444", margin: "0 0 6px 0" }}>[ALERT] {t("alertDownTitle")}: checkout-service</h4>
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
        <Reveal className="section-head">
          <span className="section-tag">{t("whyTag")}</span>
          <h2>{t("whyTitle")}</h2>
          <p className="dim">{t("whyDesc")}</p>
        </Reveal>

        <div className="why-grid">
          <div className="why-card">
            <div className="why-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3BD671" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <h3>{t("why1Title")}</h3>
            <p className="dim">
              {t("why1Desc")}
            </p>
          </div>

          <div className="why-card">
            <div className="why-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3BD671" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
              </svg>
            </div>
            <h3>{t("why2Title")}</h3>
            <p className="dim">
              {t("why2Desc")}
            </p>
          </div>

          <div className="why-card">
            <div className="why-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3BD671" strokeWidth="2">
                <rect width="18" height="18" x="3" y="3" rx="2" />
                <path d="M7 8h10M7 12h10" />
              </svg>
            </div>
            <h3>{t("why3Title")}</h3>
            <p className="dim">
              {t("why3Desc")}
            </p>
          </div>

          <div className="why-card">
            <div className="why-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3BD671" strokeWidth="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            </div>
            <h3>{t("why4Title")}</h3>
            <p className="dim">
              {t("why4Desc")}
            </p>
          </div>
        </div>
      </section>

      {/* 6. TRANSPARENT CAPACITY PRICING */}
      <section className="donate-strip" id="pricing">
        <Reveal className="section-head">
          <span className="section-tag">{t("pricingTag")}</span>
          <h2>{t("pricingTitle")}</h2>
          <p className="donate-lede">
            {t("pricingLede")}
          </p>
        </Reveal>

        <div className="donate-grid">
          <div className="donate-card">
            <span className="donate-label">{t("freeForeverLabel")}</span>
            <strong className="donate-figure">14,400</strong>
            <span className="dim">{t("checksPerDay")}</span>
            <p className="dim">
              {t("freeDesc")}
            </p>
          </div>

          <div className="donate-card accent">
            <span className="donate-label">{t("coffeeAddsLabel")}</span>
            <strong className="donate-figure">897,000</strong>
            <span className="dim">{t("checksUnit")}</span>
            <p className="dim">
              {t("coffeeDesc")}
            </p>
            <button
              type="button"
              className="coffee-btn"
              style={{ marginTop: 14 }}
              onClick={handleDonate}
              disabled={isSigningIn || isGithubSigningIn}
            >
              <span aria-hidden>☕</span>
              {isSigningIn ? t("heroConnecting") : t("buyCoffeeBtn")}
            </button>
            <p className="dim" style={{ marginTop: 8, fontSize: "0.72rem" }}>
              {t("coffeeNotice")}
            </p>
          </div>

          <div className="donate-card">
            <span className="donate-label">{t("ifCreditRunsOutLabel")}</span>
            <strong className="donate-figure">{t("nothingDeletedFigure")}</strong>
            <span className="dim">is deleted</span>
            <p className="dim">
              {t("graceDesc")}
            </p>
          </div>
        </div>

        <p className="donate-why">
          {t("whyCapacityExplanation")}
        </p>
      </section>

      {/* 7. SEMANTIC ACCESSIBLE FAQ ACCORDION */}
      <section className="faq-section" id="faq">
        <Reveal className="section-head">
          <span className="section-tag">{t("faqTag")}</span>
          <h2>{t("faqTitle")}</h2>
          <p className="dim">{t("faqDesc")}</p>
        </Reveal>

        <div className="faq-accordion-wrap glass">
          <details name="faq" className="faq-item" open>
            <summary className="faq-summary">
              <span>{t("faq1Q")}</span>
              <span className="faq-chevron" aria-hidden="true">▾</span>
            </summary>
            <div className="faq-content">
              <p>{t("faq1A")}</p>
            </div>
          </details>

          <details name="faq" className="faq-item">
            <summary className="faq-summary">
              <span>{t("faq2Q")}</span>
              <span className="faq-chevron" aria-hidden="true">▾</span>
            </summary>
            <div className="faq-content">
              <p>{t("faq2A")}</p>
            </div>
          </details>

          <details name="faq" className="faq-item">
            <summary className="faq-summary">
              <span>{t("faq3Q")}</span>
              <span className="faq-chevron" aria-hidden="true">▾</span>
            </summary>
            <div className="faq-content">
              <p>{t("faq3A")}</p>
            </div>
          </details>

          <details name="faq" className="faq-item">
            <summary className="faq-summary">
              <span>{t("faq4Q")}</span>
              <span className="faq-chevron" aria-hidden="true">▾</span>
            </summary>
            <div className="faq-content">
              <p>{t("faq4A")}</p>
            </div>
          </details>

          <details name="faq" className="faq-item">
            <summary className="faq-summary">
              <span>{t("faq5Q")}</span>
              <span className="faq-chevron" aria-hidden="true">▾</span>
            </summary>
            <div className="faq-content">
              <p>{t("faq5A")}</p>
            </div>
          </details>
        </div>
      </section>

      {/* 8. FRICTIONLESS BOTTOM CONVERSION BANNER */}
      <section className="cta-banner glass-strong">
        <div className="cta-banner-content">
          <div className="cta-tag">{t("ctaTag")}</div>
          <h2>{t("ctaTitle")}</h2>
          <p className="dim">
            {t("ctaDesc")}
          </p>
          {currentUser ? (
            <a
              href="/dashboard"
              className="primary"
              style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "8px", padding: "12px 28px", fontSize: "1rem" }}
            >
              <span>{t("dashboardBtn")}</span>
              <span>→</span>
            </a>
          ) : (
            <div className="row" style={{ gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
              <button
                type="button"
                className="google-btn-light"
                onClick={() => handleGoogleSignIn(getDestination(quickUrl, selectedPreset))}
                disabled={isSigningIn || isGithubSigningIn}
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
                <span>{isSigningIn ? t("heroConnecting") : t("continueWithGoogle")}</span>
              </button>

              <button
                type="button"
                className="github-btn-dark"
                onClick={() => handleGithubSignIn(getDestination(quickUrl, selectedPreset))}
                disabled={isSigningIn || isGithubSigningIn}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="currentColor" d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                </svg>
                <span>{isGithubSigningIn ? t("heroConnecting") : t("continueWithGithub")}</span>
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
                <span>{t("startFreeMonitoring")}</span>
              </button>
            </div>
          )}
          <span className="dim" style={{ fontSize: "0.78rem" }}>
            {t("ctaFooterNotice")}
          </span>
        </div>
      </section>

      {/* 9. MINIMAL FOOTER */}
      <footer className="app-footer">
        <div className="row" style={{ gap: "10px", alignItems: "center" }}>
          <span>{t("footerTagline")}</span>
        </div>
        <div className="row" style={{ gap: "16px", alignItems: "center" }}>
          <LanguagePicker compact />
          <a href="#hero" className="dim" style={{ fontSize: "0.8rem", textDecoration: "none" }}>{t("backToTop")}</a>
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
            window.location.href = getDestination(quickUrl, selectedPreset);
          }
        }}
      />
    </main>
  );
}
