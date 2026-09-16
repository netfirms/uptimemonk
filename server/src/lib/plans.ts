import type { Org } from "../types.js";
import { FREE_CHECKS_PER_DAY, HARD_MAX_MONITORS, HARD_MIN_INTERVAL_SECONDS } from "./credits.js";

/**
 * What used to be the paywall.
 *
 * There are no paid plans any more. Every feature — every check type,
 * sub-minute intervals, status pages, multi-region, the API — works on a free
 * workspace. What a donation buys is *capacity*, because capacity is the only
 * part that genuinely costs money: a probe, a row, a sample. See `credits.ts`.
 *
 * This file survives for one reason: `orgs.plan` still exists in Firestore and
 * SQLite, and legacy paid orgs must not silently lose what they were sold. A
 * grandfathered plan raises the *floor* on capacity; it never lowers it.
 *
 * Nothing new should read `PLANS`. New gates belong in `credits.ts`, where the
 * unit is checks rather than a tier name.
 */

export interface PlanLimits {
  id: Org["plan"];
  label: string;
  /** Free capacity this plan guarantees, on top of the standard allowance. */
  bonusChecksPerDay: number;
  maxMonitors: number;
  minIntervalSeconds: number;
  maxStatusPages: number;
  maxSeats: number;
  retentionDays: number;
  multiRegion: boolean;
  customDomain: boolean;
  apiAccess: boolean;
}

/** Everything is on for everyone now; only capacity differs. */
const OPEN = {
  maxMonitors: HARD_MAX_MONITORS,
  minIntervalSeconds: HARD_MIN_INTERVAL_SECONDS,
  maxStatusPages: 100,
  maxSeats: 50,
  retentionDays: 365,
  multiRegion: true,
  customDomain: true,
  apiAccess: true,
} as const;

export const PLANS: Record<Org["plan"], PlanLimits> = {
  free: { id: "free", label: "Free", bonusChecksPerDay: 0, ...OPEN },

  // Grandfathered. The bonus is roughly what each plan's old monitor cap
  // bought at its old interval floor, so nobody who paid ends up worse off
  // than they were under the paywall.
  solo: { id: "solo", label: "Supporter", bonusChecksPerDay: 50 * 1_440, ...OPEN },
  team: { id: "team", label: "Backer", bonusChecksPerDay: 200 * 1_440, ...OPEN },
  scale: { id: "scale", label: "Patron", bonusChecksPerDay: 1_000 * 1_440, ...OPEN },
};

export function limitsFor(plan: Org["plan"] | undefined): PlanLimits {
  return PLANS[plan ?? "free"];
}

/** The free daily allowance for an org, including any grandfathered bonus. */
export function baseChecksPerDay(plan: Org["plan"] | undefined): number {
  return FREE_CHECKS_PER_DAY + limitsFor(plan).bonusChecksPerDay;
}
