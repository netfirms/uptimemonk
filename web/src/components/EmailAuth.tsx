"use client";

import { useState } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  updateProfile,
  type User,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { events } from "@/lib/analytics";

/**
 * Email and password sign-in, beside the Google button.
 *
 * Google is still the shorter path and stays first. This exists for people
 * who do not have a Google account, or will not use one to sign in to a
 * third-party service — which is a reasonable position, and refusing them an
 * account over it costs a customer.
 *
 * A sign-up here proves nothing about the address, unlike a Google sign-in.
 * Firebase records that as `email_verified: false`, the server reads it when
 * bootstrapping the workspace, and the alert contact it creates stays
 * unverified until confirmed. Without that, someone could sign up as a
 * stranger and have this service mail them downtime alerts.
 */

type Mode = "signin" | "signup" | "reset";

/** Firebase's own messages are written for developers. These are not. */
function readable(code: string | undefined, fallback: string): string {
  switch (code) {
    case "auth/invalid-email":
      return "That does not look like an email address.";
    case "auth/missing-password":
      return "Enter your password.";
    case "auth/weak-password":
      return "Passwords need at least six characters. Longer is better.";
    case "auth/email-already-in-use":
      return "There is already an account with that address. Try signing in instead.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      // Deliberately one message for all three: saying which half was wrong
      // tells a stranger whether an address has an account here.
      return "That email and password do not match an account.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a few minutes, or reset your password.";
    case "auth/network-request-failed":
      return "Could not reach the network. Check your connection and try again.";
    case "auth/unauthorized-domain":
      return "This domain is not authorised for sign-in yet.";
    case "auth/operation-not-allowed":
      return "Email sign-in is not enabled on this project.";
    default:
      return fallback;
  }
}

export default function EmailAuth({
  onSignedIn,
  next = "/dashboard",
}: {
  onSignedIn?: (user: User) => void;
  next?: string;
}) {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const done = (user: User) => {
    if (onSignedIn) onSignedIn(user);
    else window.location.href = next;
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      if (mode === "reset") {
        await sendPasswordResetEmail(auth, email.trim());
        // Same message whether or not the account exists, so this cannot be
        // used to discover who has one.
        setNotice(`If an account exists for ${email.trim()}, a reset link is on its way.`);
        setMode("signin");
        return;
      }

      if (mode === "signup") {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        if (name.trim()) {
          await updateProfile(cred.user, { displayName: name.trim() });
        }
        // Fire and forget: a failure to send must not block an account that
        // has already been created, and the address can be confirmed later.
        void sendEmailVerification(cred.user).catch(() => {});
        void events.signUpBootstrapped();
        done(cred.user);
        return;
      }

      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      void events.signIn("password");
      done(cred.user);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      setError(readable(code, (err as Error)?.message || "Something went wrong."));
      void events.actionFailed(`auth_${mode}`);
    } finally {
      setBusy(false);
    }
  }

  const heading =
    mode === "signup"
      ? "Create an account"
      : mode === "reset"
        ? "Reset your password"
        : "Sign in with email";

  return (
    <form className="email-auth" onSubmit={submit}>
      <div className="email-auth-head">
        <span>{heading}</span>
      </div>

      {notice && <div className="banner ok">{notice}</div>}
      {error && (
        <div className="banner err" role="alert">
          {error}
        </div>
      )}

      {mode === "signup" && (
        <label className="email-auth-field">
          <span>Name</span>
          <input
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
          />
        </label>
      )}

      <label className="email-auth-field">
        <span>Email</span>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
      </label>

      {mode !== "reset" && (
        <label className="email-auth-field">
          <span>Password</span>
          <input
            type="password"
            required
            minLength={6}
            /* Tells a password manager to offer a new one rather than
               autofilling the existing account's. */
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === "signup" ? "At least 6 characters" : "Your password"}
          />
        </label>
      )}

      <button type="submit" className="primary email-auth-submit" disabled={busy}>
        {busy
          ? "Working…"
          : mode === "signup"
            ? "Create account"
            : mode === "reset"
              ? "Send reset link"
              : "Sign in"}
      </button>

      <div className="email-auth-switch">
        {mode === "signin" && (
          <>
            <button type="button" onClick={() => { setMode("signup"); setError(null); }}>
              Create an account
            </button>
            <span aria-hidden>·</span>
            <button type="button" onClick={() => { setMode("reset"); setError(null); }}>
              Forgot password?
            </button>
          </>
        )}
        {mode !== "signin" && (
          <button type="button" onClick={() => { setMode("signin"); setError(null); }}>
            ← Back to sign in
          </button>
        )}
      </div>
    </form>
  );
}
