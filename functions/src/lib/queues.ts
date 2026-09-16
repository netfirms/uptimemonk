import { getFunctions } from "firebase-admin/functions";
import { QUEUE_NAME, PRIMARY_REGION } from "../config";
import type { AlertTask, CheckTask, Monitor, ProbeRegion } from "../types";

export function primaryRegionOf(monitor: Monitor): ProbeRegion {
  return monitor.regions?.[0] ?? PRIMARY_REGION;
}

/** Second-opinion region, used to confirm a failure before we alert anyone. */
export function verifyRegionOf(monitor: Monitor): ProbeRegion | null {
  const [primary, secondary] = monitor.regions ?? [];
  if (secondary && secondary !== primary) return secondary;
  return null;
}

export async function enqueueCheck(
  monitorId: string,
  region: ProbeRegion,
  extra: Partial<CheckTask> = {}
): Promise<void> {
  const queue = getFunctions().taskQueue<CheckTask>(QUEUE_NAME[region], region);
  await queue.enqueue({ monitorId, ...extra });
}

export async function enqueueAlert(task: AlertTask): Promise<void> {
  const queue = getFunctions().taskQueue<AlertTask>("sendAlerts", PRIMARY_REGION);
  await queue.enqueue(task);
}
