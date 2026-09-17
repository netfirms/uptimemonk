"use client";

/**
 * reCAPTCHA v3, loaded on demand.
 *
 * v3 is invisible — no puzzle, no checkbox. It watches behaviour and returns
 * a score, which the worker checks when a workspace is created.
 *
 * Loaded lazily rather than in the document head, because it is a
 * third-party script that fetches more third-party script, and every visitor
 * to the marketing page would pay for it whether or not they ever sign up.
 *
 * Every failure path returns undefined rather than throwing. The server
 * treats a missing token as a failure only when it is configured to care, so
 * a blocked or slow Google must never be the reason someone cannot sign up.
 */

const SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ?? "";
const SCRIPT_ID = "recaptcha-v3";

declare global {
  interface Window {
    grecaptcha?: {
      ready: (cb: () => void) => void;
      execute: (siteKey: string, opts: { action: string }) => Promise<string>;
    };
  }
}

export const recaptchaConfigured = () => Boolean(SITE_KEY);

let loading: Promise<boolean> | null = null;

function load(): Promise<boolean> {
  if (typeof window === "undefined" || !SITE_KEY) return Promise.resolve(false);
  if (window.grecaptcha) return Promise.resolve(true);
  if (loading) return loading;

  loading = new Promise<boolean>((resolve) => {
    const existing = document.getElementById(SCRIPT_ID);
    if (existing) return resolve(true);

    const el = document.createElement("script");
    el.id = SCRIPT_ID;
    el.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(SITE_KEY)}`;
    el.async = true;
    el.onload = () => resolve(true);
    // An ad blocker or a network without Google reachable. Not an error the
    // customer should ever see.
    el.onerror = () => resolve(false);
    document.head.appendChild(el);
  });

  return loading;
}

/** Warm the script up while someone is still typing, so the token is ready. */
export function prewarmRecaptcha(): void {
  void load();
}

/**
 * A token for one action, or undefined if reCAPTCHA cannot run here.
 *
 * Bounded, because a hung third-party script must not hang a sign-up.
 */
export async function recaptchaToken(action: string): Promise<string | undefined> {
  if (!(await load())) return undefined;
  const g = window.grecaptcha;
  if (!g) return undefined;

  try {
    return await Promise.race([
      new Promise<string>((resolve, reject) => {
        g.ready(() => g.execute(SITE_KEY, { action }).then(resolve, reject));
      }),
      new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), 6000)),
    ]);
  } catch {
    return undefined;
  }
}
