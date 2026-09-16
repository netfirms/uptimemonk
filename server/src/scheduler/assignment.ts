/**
 * Which worker owns which work.
 *
 * A worker is one Lightsail instance. Scaling out means running more of them,
 * and the fleet has no shared database — each worker has its own SQLite — so
 * ownership has to be decidable locally, with no coordination, no leases and
 * no lock service. A stable hash does that: every worker computes the same
 * answer independently, and a monitor is probed exactly once across the fleet.
 *
 * Sharding is by ORGANISATION, not by monitor, and that is deliberate. The
 * status mirror is one Firestore document per org; if two workers owned
 * monitors in the same org they would both write that document, and "one
 * writer per field" is the rule this whole architecture rests on. Keeping an
 * org whole also means its flush is a single write rather than one per worker.
 */

export interface WorkerIdentity {
  /** Probe vantage point. Monitors name their home region. */
  region: string;
  /** 0-based position of this worker within its region's pool. */
  index: number;
  /** How many workers serve this region. */
  count: number;
}

/**
 * FNV-1a. Same function the due-time jitter uses, for one reason: two hashes
 * with different distributions would make the fleet's load and its timing
 * spread interact in ways nobody wants to debug.
 */
export function shardHash(key: string): number {
  let hash = 2166136261;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

/** Which worker index in the pool should serve this organisation. */
export function shardFor(orgId: string, count: number): number {
  if (count <= 1) return 0;
  return shardHash(orgId) % count;
}

/**
 * Does this worker own the given org's monitors?
 *
 * `homeRegion` comes from the monitor's own `regions[0]`. A monitor with no
 * region is treated as belonging to whichever region asks, so a single-region
 * deployment needs no configuration at all.
 */
export function ownsOrg(
  orgId: string,
  homeRegion: string | undefined,
  worker: WorkerIdentity
): boolean {
  if (homeRegion && homeRegion !== worker.region) return false;
  return shardFor(orgId, worker.count) === worker.index;
}

/**
 * Rebalancing check, for the operator rather than the runtime.
 *
 * Changing `count` reshuffles orgs between workers, and a worker that inherits
 * an org has no local history for it — its SQLite knows nothing about the
 * monitor's current status or its open incidents. Returns the orgs that would
 * move, so a rebalance can be done knowingly rather than discovered afterwards.
 */
export function orgsMovedBy(orgIds: string[], fromCount: number, toCount: number): string[] {
  if (fromCount === toCount) return [];
  return orgIds.filter((id) => shardFor(id, fromCount) !== shardFor(id, toCount));
}
