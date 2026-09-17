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
  type User,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { events } from "@/lib/analytics";
import { prewarmRecaptcha } from "@/lib/recaptcha";

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
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
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
        {/* Close Button */}
        <button
          type="button"
          className="auth-modal-close"
          onClick={onClose}
          aria-label="Close dialog"
        >
          ✕
        </button>

        {/* Brand Mascot & Heading */}
        <div className="auth-modal-header">
          <div className="auth-modal-logo">
            <img src="/mascot-128.png" alt="UptimeMonke Mascot" width={52} height={52} />
          </div>
          <h2 id="auth-modal-title" className="auth-modal-title">
            {mode === "signup"
              ? "Start monitoring in seconds"
              : mode === "reset"
              ? "Reset your password"
              : "Welcome back"}
          </h2>
          <p className="auth-modal-subtitle">
            {mode === "signup"
              ? targetUrl
                ? `Ready to monitor ${targetUrl.replace(/^https?:\/\//, "")} on the edge.`
                : "14,400 free checks daily forever. No credit card required."
              : mode === "reset"
              ? "Enter your email to receive a recovery link."
              : "Access your monitors, incidents, and status pages."}
          </p>
        </div>

        {/* Tab Switcher (Sign Up vs Sign In) */}
        {mode !== "reset" && (
          <div className="auth-modal-tabs">
            <button
              type="button"
              className={`auth-modal-tab ${mode === "signup" ? "active" : ""}`}
              onClick={() => {
                setMode("signup");
                setError(null);
              }}
            >
              Create Account
            </button>
            <button
              type="button"
              className={`auth-modal-tab ${mode === "signin" ? "active" : ""}`}
              onClick={() => {
                setMode("signin");
                setError(null);
              }}
            >
              Sign In
            </button>
          </div>
        )}

        {/* Notification / Error Banners */}
        {notice && (
          <div className="auth-alert ok" role="status">
            <span>{notice}</span>
          </div>
        )}
        {error && (
          <div className="auth-alert err" role="alert">
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
              disabled={googleBusy || busy}
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
              <span>{googleBusy ? "Connecting to Google…" : "Continue with Google"}</span>
            </button>

            <div className="auth-divider">
              <span>or continue with email</span>
            </div>
          </div>
        )}

        {/* Email & Password Form */}
        <form className="auth-modal-form" onSubmit={handleSubmit}>
          {mode === "signup" && (
            <div className="auth-field">
              <label htmlFor="auth-name">Your Name</label>
              <input
                id="auth-name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Alex Developer"
              />
            </div>
          )}

          <div className="auth-field">
            <label htmlFor="auth-email">Work or Personal Email</label>
            <input
              id="auth-email"
              ref={emailInputRef}
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
            />
          </div>

          {mode !== "reset" && (
            <div className="auth-field">
              <div className="auth-label-row">
                <label htmlFor="auth-password">Password</label>
                {mode === "signin" && (
                  <button
                    type="button"
                    className="auth-link-subtle"
                    onClick={() => {
                      setMode("reset");
                      setError(null);
                    }}
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="auth-input-wrap">
                <input
                  id="auth-password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === "signup" ? "At least 6 characters" : "Enter password"}
                />
                <button
                  type="button"
                  className="auth-pwd-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  title={showPassword ? "Hide password" : "Show password"}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? "🙈" : "👁️"}
                </button>
              </div>
              {mode === "signup" && password.length > 0 && (
                <div className="auth-pwd-strength">
                  <span
                    className={`strength-bar ${
                      password.length >= 10 ? "strong" : password.length >= 6 ? "medium" : "weak"
                    }`}
                  />
                  <span className="strength-text">
                    {password.length >= 10
                      ? "Great password"
                      : password.length >= 6
                      ? "Decent password"
                      : "Too short"}
                  </span>
                </div>
              )}
            </div>
          )}

          <button
            type="submit"
            className="btn-auth-submit"
            disabled={busy || googleBusy}
          >
            {busy ? (
              <span>Processing…</span>
            ) : mode === "signup" ? (
              <span>Create Free Account →</span>
            ) : mode === "reset" ? (
              <span>Send Reset Instructions</span>
            ) : (
              <span>Sign In to Dashboard →</span>
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
              ← Back to sign in
            </button>
          ) : mode === "signin" ? (
            <p>
              Don't have an account yet?{" "}
              <button
                type="button"
                className="auth-link-highlight"
                onClick={() => {
                  setMode("signup");
                  setError(null);
                }}
              >
                Sign up for free
              </button>
            </p>
          ) : (
            <p>
              Already have an account?{" "}
              <button
                type="button"
                className="auth-link-highlight"
                onClick={() => {
                  setMode("signin");
                  setError(null);
                }}
              >
                Sign in here
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
