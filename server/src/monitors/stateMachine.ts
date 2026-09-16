import type { MonitorStatus } from "../types.js";

/**
 * The up/down decision, extracted from Firestore so it can be tested.
 *
 * This is the highest-consequence logic in the product: get it wrong in one
 * direction and customers are paged at 3am for nothing, wrong in the other and
 * a real outage goes unreported. It is worth having no I/O in it at all.
 */
export interface Transition {
  status: MonitorStatus;
  /** Running count of consecutive failures after this result. */
  failures: number;
  /** An incident opens here. */
  transitionedDown: boolean;
  /** An open incident resolves here. */
  transitionedUp: boolean;
}

export function decideTransition(args: {
  previousStatus: MonitorStatus | undefined;
  previousFailures: number | undefined;
  ok: boolean;
  /** Consecutive failures required before an outage is declared. */
  threshold: number;
}): Transition {
  const prev: MonitorStatus = args.previousStatus ?? "pending";
  const threshold = Math.max(1, args.threshold || 2);
  const failures = args.ok ? 0 : (args.previousFailures || 0) + 1;

  let status: MonitorStatus = prev;
  if (args.ok) {
    status = "up";
  } else if (failures >= threshold) {
    status = "down";
  } else if (prev === "pending") {
    status = "pending";
  }

  return {
    status,
    failures,
    transitionedDown: status === "down" && prev !== "down",
    transitionedUp: status === "up" && prev === "down",
  };
}
