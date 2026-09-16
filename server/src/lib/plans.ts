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
 * comparison buyers actually make. Keep the free tier generous but capped at
 * 5-minute checks — that is the cost line on Firebase.
 */
export const PLANS: Record<Org["plan"], PlanLimits> = {
  free: {
    id: "free",
    label: "Free",
    priceUsdMonthly: 0,
    maxMonitors: 20,
    minIntervalSeconds: 300,
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
    minIntervalSeconds: 60,
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
    minIntervalSeconds: 60,
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
    minIntervalSeconds: 60,
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
