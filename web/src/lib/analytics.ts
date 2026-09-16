"use client";

import { logEvent, setUserProperties } from "firebase/analytics";
import { initAnalytics } from "./firebase";

/**
 * Product analytics.
 *
 * Every call is fire-and-forget and swallows its own errors. Measurement must
 * never be able to break a page, and it must never block one either — the
 * analytics SDK loads lazily and may legitimately never load at all (privacy
 * browsers, blocked cookies, ad blockers), which is a normal outcome rather
 * than a failure to handle.
 *
 * Deliberately no personal data: no email addresses, no monitor targets, no
 * URLs a customer is watching. Those are the customer's business, they would
 * end up in Google's logs, and none of them are needed to answer the questions
 * this exists for — which features get used, and where people give up.
 */

type Params = Record<string, string | number | boolean | undefined>;

export async function track(event: string, params: Params = {}): Promise<void> {
  try {
    const analytics = await initAnalytics();
    if (!analytics) return;
    logEvent(analytics, event, params as never);
  } catch {
    // Never surface a measurement failure to the user.
  }
}

/**
 * A page view. The dashboard is a single page that swaps panels, so route
 * changes have to be reported by hand — the SDK's automatic tracking only sees
 * the first load.
 */
export function trackPageView(path: string, title?: string): void {
  void track("page_view", {
    page_path: path,
    page_title: title ?? (typeof document !== "undefined" ? document.title : undefined),
    page_location: typeof window !== "undefined" ? window.location.href : undefined,
  });
}

/** Plan is useful for segmenting; the org id is an opaque identifier, not PII. */
export async function identify(orgId: string, plan?: string): Promise<void> {
  try {
    const analytics = await initAnalytics();
    if (!analytics) return;
    setUserProperties(analytics, { org_id: orgId, plan: plan ?? "unknown" });
  } catch {
    /* ignore */
  }
}

/**
 * The events worth having names for.
 *
 * Kept as a closed set rather than free-form strings: an event named three
 * different ways across the codebase is worse than no event, because the
 * numbers look real and are not.
 */
export const events = {
  signIn: (method: string) => track("login", { method }),
  signUpBootstrapped: () => track("sign_up", { method: "google" }),

  monitorCreated: (type: string, intervalSeconds: number) =>
    track("monitor_created", { monitor_type: type, interval_seconds: intervalSeconds }),
  monitorEdited: (type: string) => track("monitor_edited", { monitor_type: type }),
  monitorDeleted: (type: string) => track("monitor_deleted", { monitor_type: type }),
  monitorPaused: (paused: boolean) => track("monitor_paused", { paused }),

  historyViewed: (type: string) => track("history_viewed", { monitor_type: type }),

  /** Channel only — never the destination, which is a real address. */
  contactAdded: (channel: string) => track("contact_added", { channel }),
  contactVerified: (channel: string) => track("contact_verified", { channel }),
  contactTested: (channel: string, ok: boolean) =>
    track("contact_tested", { channel, ok }),

  /** Amount only — no customer or payment identifiers. */
  donateStarted: (usd: number) => track("donate_started", { usd }),
  capacityBlocked: () => track("capacity_blocked"),

  /** The failure the user actually saw — how we learn which errors are common. */
  actionFailed: (action: string, status?: number) =>
    track("action_failed", { action, status }),
} as const;
