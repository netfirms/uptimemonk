"use client";

import { useEffect, useState, useRef } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  updateProfile,
  signInWithPopup,
  signInWithRedirect,
  GoogleAuthProvider,
  GithubAuthProvider,
  type User,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { events } from "@/lib/analytics";
import { prewarmRecaptcha } from "@/lib/recaptcha";
import { useI18n } from "@/lib/i18n/context";
import LanguagePicker from "./LanguagePicker";

export type AuthMode = "signup" | "signin" | "reset";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: AuthMode;
  targetUrl?: string;
  onSignedIn?: (user: User) => void;
}

function readableAuthError(code: string | undefined, fallback: string): string {
  switch (code) {
    case "auth/invalid-email":
      return "That does not look like a valid email address.";
    case "auth/missing-password":
      return "Please enter your password.";
    case "auth/weak-password":
      return "Passwords must be at least 6 characters long.";
    case "auth/email-already-in-use":
      return "An account with this email already exists. Try signing in instead.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Incorrect email or password. Please try again.";
    case "auth/too-many-requests":
      return "Too many failed attempts. Please wait a few moments or reset your password.";
    case "auth/network-request-failed":
      return "Network connection issue. Please check your internet connection.";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "";
    case "auth/popup-blocked":
    case "auth/unauthorized-domain":
      return "Sign-in popup was blocked. Please allow popups or use email sign-in.";
    default:
      return fallback || "An unexpected error occurred. Please try again.";
  }
}

export default function AuthModal({
  isOpen,
  onClose,
  initialMode = "signup",
  targetUrl,
  onSignedIn,
}: AuthModalProps) {
  const { t } = useI18n();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [githubBusy, setGithubBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);

  // Sync mode when initialMode changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setError(null);
      setNotice(null);
      prewarmRecaptcha();
      // Focus email input
      setTimeout(() => emailInputRef.current?.focus(), 50);
    }
  }, [isOpen, initialMode]);

  // Handle ESC key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const navigateDestination = targetUrl
    ? `/dashboard?new=${encodeURIComponent(targetUrl)}`
    : "/dashboard";

  const handleDone = (user: User) => {
    if (onSignedIn) {
      onSignedIn(user);
    } else {
      window.location.href = navigateDestination;
    }
  };

  async function handleGoogleSignIn() {
    setError(null);
    setGoogleBusy(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const res = await signInWithPopup(auth, provider);
      void events.signIn("google");
      handleDone(res.user);
    } catch (err: unknown) {
      console.error("Google sign-in error:", err);
      const code = (err as { code?: string })?.code;
      if (code === "auth/popup-blocked" || code === "auth/unauthorized-domain") {
        try {
          const provider = new GoogleAuthProvider();
          provider.setCustomParameters({ prompt: "select_account" });
          await signInWithRedirect(auth, provider);
          return;
        } catch (redirectErr) {
          setError(readableAuthError((redirectErr as { code?: string })?.code, "Google sign-in popup was blocked."));
        }
      } else {
        const msg = readableAuthError(code, (err as Error)?.message);
        if (msg) setError(msg);
      }
    } finally {
      setGoogleBusy(false);
    }
  }

  /**
   * GitHub sign-in.
   *
   * Same popup-then-redirect shape as Google: a popup is the better
   * experience, but browsers block it often enough that falling back rather
   * than showing an error is what makes it reliable.
   *
   * Note the account it returns may carry `emailVerified: false` — Firebase
   * only sets that flag for Google. The confirmation gate keys on the sign-in
   * provider rather than the flag for exactly this reason; see
   * `needsEmailConfirmation`.
   */
  async function handleGithubSignIn() {
    setError(null);
    setGithubBusy(true);
    try {
      const provider = new GithubAuthProvider();
      provider.addScope("read:user");
      provider.addScope("user:email");
      const res = await signInWithPopup(auth, provider);
      void events.signIn("github");
      handleDone(res.user);
    } catch (err: unknown) {
      console.error("GitHub sign-in error:", err);
      const code = (err as { code?: string })?.code;
      if (code === "auth/popup-blocked" || code === "auth/unauthorized-domain") {
        try {
          const provider = new GithubAuthProvider();
          provider.addScope("read:user");
          provider.addScope("user:email");
          await signInWithRedirect(auth, provider);
          return;
        } catch (redirectErr) {
          setError(readableAuthError((redirectErr as { code?: string })?.code, "GitHub sign-in popup was blocked."));
        }
      } else {
        const msg = readableAuthError(code, (err as Error)?.message);
        if (msg) setError(msg);
      }
    } finally {
      setGithubBusy(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);

    const cleanEmail = email.trim();

    try {
      if (mode === "reset") {
        await sendPasswordResetEmail(auth, cleanEmail);
        setNotice(`If an account exists for ${cleanEmail}, a password reset link has been sent.`);
        setMode("signin");
        return;
      }

      if (mode === "signup") {
        const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        if (name.trim()) {
          await updateProfile(cred.user, { displayName: name.trim() });
        }
        void sendEmailVerification(cred.user).catch(() => {});
        void events.signUpBootstrapped();
        handleDone(cred.user);
        return;
      }

      const cred = await signInWithEmailAndPassword(auth, cleanEmail, password);
      void events.signIn("password");
      handleDone(cred.user);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      setError(readableAuthError(code, (err as Error)?.message || "Authentication failed."));
      void events.actionFailed(`auth_${mode}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="auth-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div
        className="auth-modal-dialog"
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
      >
        {/* Top bar with language switcher and close button */}
        <div className="auth-modal-top-bar">
          <LanguagePicker compact />
          <button
            type="button"
            className="auth-modal-close"
            onClick={onClose}
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>

        {/* Brand Mascot & Heading */}
        <div className="auth-modal-header">
          <div className="auth-modal-logo-wrap">
            <div className="auth-modal-logo-halo" />
            <img src="/mascot-128.png" alt="UptimeMonke Mascot" width={56} height={56} className="auth-modal-mascot-img" />
          </div>
          <h2 id="auth-modal-title" className="auth-modal-title">
            {mode === "signup"
              ? t("authStartMonitoring")
              : mode === "reset"
              ? t("authResetPassword")
              : t("authWelcomeBack")}
          </h2>
          <p className="auth-modal-subtitle">
            {mode === "signup"
              ? targetUrl
                ? `Ready to monitor ${targetUrl.replace(/^https?:\/\//, "")} on the edge.`
                : t("authSubtitleSignUp")
              : mode === "reset"
              ? t("authSubtitleReset")
              : t("authSubtitleSignIn")}
          </p>
        </div>

        <div className="auth-modal-body">
          {/* Segmented Control Tabs (Sign Up vs Sign In) */}
          {mode !== "reset" && (
            <div className="auth-modal-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={mode === "signup"}
                className={`auth-modal-tab ${mode === "signup" ? "active" : ""}`}
                onClick={() => {
                  setMode("signup");
                  setError(null);
                }}
              >
                {t("authCreateAccountTab")}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "signin"}
                className={`auth-modal-tab ${mode === "signin" ? "active" : ""}`}
                onClick={() => {
                  setMode("signin");
                  setError(null);
                }}
              >
                {t("authSignInTab")}
              </button>
            </div>
          )}

          {/* Notification / Error Banners */}
          {notice && (
            <div className="auth-alert ok" role="status">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <span>{notice}</span>
            </div>
          )}
          {error && (
            <div className="auth-alert err" role="alert">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* 1-Click Google Authentication */}
          {mode !== "reset" && (
            <div className="auth-modal-social">
              <button
                type="button"
                className="btn-google-social"
                onClick={handleGoogleSignIn}
                disabled={googleBusy || githubBusy || busy}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
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
                <span>{googleBusy ? t("heroConnecting") : t("continueWithGoogle")}</span>
              </button>

              <button
                type="button"
                className="btn-github-social"
                onClick={handleGithubSignIn}
                disabled={githubBusy || googleBusy || busy}
                style={{ marginTop: "10px" }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" style={{ flexShrink: 0 }} aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"
                  />
                </svg>
                <span>{githubBusy ? t("heroConnecting") : t("continueWithGithub")}</span>
              </button>

              <div className="auth-divider">
                <span>{t("authOrContinueEmail")}</span>
              </div>
            </div>
          )}

          {/* Email & Password Form */}
          <form className="auth-modal-form" onSubmit={handleSubmit}>
            {mode === "signup" && (
              <div className="auth-field">
                <label htmlFor="auth-name">{t("authYourName")}</label>
                <div className="auth-input-wrap">
                  <svg className="auth-input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  <input
                    id="auth-name"
                    className="has-icon"
                    type="text"
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Alex Developer"
                  />
                </div>
              </div>
            )}

            <div className="auth-field">
              <label htmlFor="auth-email">{t("authWorkEmail")}</label>
              <div className="auth-input-wrap">
                <svg className="auth-input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
                <input
                  id="auth-email"
                  className="has-icon"
                  ref={emailInputRef}
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                />
              </div>
            </div>

            {mode !== "reset" && (
              <div className="auth-field">
                <div className="auth-label-row">
                  <label htmlFor="auth-password">{t("authPassword")}</label>
                  {mode === "signin" && (
                    <button
                      type="button"
                      className="auth-link-subtle"
                      onClick={() => {
                        setMode("reset");
                        setError(null);
                      }}
                    >
                      {t("authForgotPassword")}
                    </button>
                  )}
                </div>
                <div className="auth-input-wrap">
                  <svg className="auth-input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  <input
                    id="auth-password"
                    className="has-icon has-toggle"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={6}
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={mode === "signup" ? "At least 6 characters" : "••••••••"}
                  />
                  <button
                    type="button"
                    className="auth-pwd-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    title={showPassword ? "Hide password" : "Show password"}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
                {mode === "signup" && password.length > 0 && (
                  <div className="auth-pwd-strength">
                    <div className="strength-bars">
                      <div className={`strength-segment ${password.length >= 1 ? (password.length >= 10 ? "strong" : password.length >= 6 ? "medium" : "weak") : ""}`} />
                      <div className={`strength-segment ${password.length >= 6 ? (password.length >= 10 ? "strong" : "medium") : ""}`} />
                      <div className={`strength-segment ${password.length >= 8 ? (password.length >= 10 ? "strong" : "medium") : ""}`} />
                      <div className={`strength-segment ${password.length >= 10 ? "strong" : ""}`} />
                    </div>
                    <span className={`strength-text ${password.length >= 10 ? "strong" : password.length >= 6 ? "medium" : "weak"}`}>
                      {password.length >= 10
                        ? t("pwdGreat")
                        : password.length >= 6
                        ? t("pwdDecent")
                        : t("pwdTooShort")}
                    </span>
                  </div>
                )}
              </div>
            )}

            <button
              type="submit"
              className="btn-auth-submit"
              disabled={busy || googleBusy || githubBusy}
            >
              {busy ? (
                <span>{t("authProcessing")}</span>
              ) : mode === "signup" ? (
                <span>{t("authCreateFreeAccountBtn")}</span>
              ) : mode === "reset" ? (
                <span>{t("authSendResetBtn")}</span>
              ) : (
                <span>{t("authSignInDashboardBtn")}</span>
              )}
            </button>
          </form>

          {/* Footer Navigation */}
          <div className="auth-modal-footer">
            {mode === "reset" ? (
              <button
                type="button"
                className="auth-link-subtle"
                onClick={() => {
                  setMode("signin");
                  setError(null);
                }}
              >
                {t("authBackToSignIn")}
              </button>
            ) : mode === "signin" ? (
              <p>
                {t("authNoAccountPrompt")}{" "}
                <button
                  type="button"
                  className="auth-link-highlight"
                  onClick={() => {
                    setMode("signup");
                    setError(null);
                  }}
                >
                  {t("authSignUpFreeLink")}
                </button>
              </p>
            ) : (
              <p>
                {t("authHaveAccountPrompt")}{" "}
                <button
                  type="button"
                  className="auth-link-highlight"
                  onClick={() => {
                    setMode("signin");
                    setError(null);
                  }}
                >
                  {t("authSignInLink")}
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
