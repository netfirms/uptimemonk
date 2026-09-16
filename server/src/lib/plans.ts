import type { Org } from "../types.js";

export interface PlanLimits {
  id: Org["plan"];
  label: string;
  priceUsdMonthly: number;
  maxMonitors: number;
  minIntervalSeconds: number;
  maxStatusPages: number;
  maxSeats: number;
  retentionDays: number;
  multiRegion: boolean;
  customDomain: boolean;
  apiAccess: boolean;
}

/**
 * Deliberately undercuts UptimeRobot on interval-per-dollar, which is the
 * comparison buyers actually make.
 *
 * The free tier was capped at 5-minute checks because that was the cost line
 * on Firebase, where every check was billed writes. Checks now run on a flat-
 * rate box, so that reasoning is gone: free gets 1-minute, and paid gets
 * 5-second — which Cloud Scheduler could not have done at any price, since its
 * floor was 60 seconds.
 *
 * 5 seconds is 12x the load of 1 minute. See the capacity note in
 * scheduler.ts before selling it at volume.
 */
export const PLANS: Record<Org["plan"], PlanLimits> = {
  free: {
    id: "free",
    label: "Free",
    priceUsdMonthly: 0,
    maxMonitors: 10,
    minIntervalSeconds: 60,
    maxStatusPages: 1,
    maxSeats: 1,
    retentionDays: 30,
    multiRegion: false,
    customDomain: false,
    apiAccess: false,
  },
  solo: {
    id: "solo",
    label: "Solo",
    priceUsdMonthly: 9,
    maxMonitors: 50,
    minIntervalSeconds: 5,
    maxStatusPages: 3,
    maxSeats: 2,
    retentionDays: 180,
    multiRegion: true,
    customDomain: true,
    apiAccess: true,
  },
  team: {
    id: "team",
    label: "Team",
    priceUsdMonthly: 29,
    maxMonitors: 200,
    minIntervalSeconds: 5,
    maxStatusPages: 20,
    maxSeats: 10,
    retentionDays: 365,
    multiRegion: true,
    customDomain: true,
    apiAccess: true,
  },
  scale: {
    id: "scale",
    label: "Scale",
    priceUsdMonthly: 79,
    maxMonitors: 1000,
    minIntervalSeconds: 5,
    maxStatusPages: 100,
    maxSeats: 50,
    retentionDays: 730,
    multiRegion: true,
    customDomain: true,
    apiAccess: true,
  },
};

export function limitsFor(plan: Org["plan"] | undefined): PlanLimits {
  return PLANS[plan ?? "free"];
}
