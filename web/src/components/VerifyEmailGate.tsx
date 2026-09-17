"use client";

import { useEffect, useState } from "react";
import { sendEmailVerification, signOut, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";

/**
 * Shown instead of the app until the address is confirmed.
 *
 * The real enforcement is server-side — `requireAuth` refuses an unverified
 * token — so this is not the lock, it is the explanation. Without it the
 * dashboard would simply fail every request with no way to understand why.
 *
 * The trap here is token staleness. Clicking the link updates the account on
 * Firebase's side, but the ID token already in the browser keeps saying
 * `email_verified: false` until it is refreshed, so the app stays locked out
 * of a verified account. `reload()` then `getIdToken(true)` is what actually
 * clears it, and polling saves the customer from guessing that a hard refresh
 * is the answer.
 */

const POLL_MS = 4000;
const RESEND_COOLDOWN_MS = 60_000;

export default function VerifyEmailGate({ user }: { user: User }) {
  const [sentAt, setSentAt] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  /** Poll quietly so a customer who verifies in another tab just gets in. */
  useEffect(() => {
    let live = true;
    const tick = async () => {
      try {
        await user.reload();
        if (!live) return;
        if (auth.currentUser?.emailVerified) {
          // Force a new token, or the API keeps seeing the stale claim.
          await auth.currentUser.getIdToken(true);
          window.location.reload();
        }
      } catch {
        /* offline, or the account was removed — the next tick retries */
      }
    };
    const timer = setInterval(tick, POLL_MS);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [user]);

  async function resend() {
    setBusy(true);
    setError(null);
    try {
      await sendEmailVerification(user);
      setSentAt(Date.now());
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      setError(
        code === "auth/too-many-requests"
          ? "Too many requests. Wait a few minutes before asking for another."
          : "Could not send the email. Try again shortly."
      );
    } finally {
      setBusy(false);
    }
  }

  /** The manual path, for someone who verified before this tab was open. */
  async function checkNow() {
    setChecking(true);
    setError(null);
    try {
      await user.reload();
      if (auth.currentUser?.emailVerified) {
        await auth.currentUser.getIdToken(true);
        window.location.reload();
        return;
      }
      setError("Still not confirmed. Check your inbox, and your spam folder.");
    } finally {
      setChecking(false);
    }
  }

  const cooling = sentAt != null && Date.now() - sentAt < RESEND_COOLDOWN_MS;

  return (
    <main className="wrap">
      <header className="topbar">
        <div className="brand-badge">
          <span className="brand-robot">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/mascot-128.png" alt="" width={56} height={56} />
          </span>
          <span className="brand-title">UptimeMonke</span>
        </div>
        <button className="btn-sm" onClick={() => signOut(auth)}>
          Sign out
        </button>
      </header>

      <div className="verify-gate">
        <h1>Confirm your email</h1>
        <p className="muted">
          We sent a link to <strong>{user.email}</strong>. Open it and this page
          will continue on its own.
        </p>

        {sentAt && !error && <div className="banner ok">Sent. It may take a minute to arrive.</div>}
        {error && (
          <div className="banner err" role="alert">
            {error}
          </div>
        )}

        <div className="verify-actions">
          <button className="primary" onClick={checkNow} disabled={checking}>
            {checking ? "Checking…" : "I've confirmed it"}
          </button>
          <button className="btn-sm" onClick={resend} disabled={busy || cooling}>
            {busy ? "Sending…" : cooling ? "Sent — wait a minute" : "Resend the email"}
          </button>
        </div>

        <p className="dim verify-note">
          Nothing is monitored until the address is confirmed, because alerts
          are sent to it — and an unconfirmed address could belong to someone
          who never asked for them.
        </p>
      </div>
    </main>
  );
}
