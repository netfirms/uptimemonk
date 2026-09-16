/**
 * A binary min-heap keyed by due time, plus the scheduling arithmetic.
 *
 * This is the component that replaces Cloud Scheduler, and with it the
 * 60-second floor that capped the product at two pricing tiers. Everything
 * here is pure and synchronous so it can be tested without a clock or a
 * database.
 */

export interface Due {
  id: string;
  dueAt: number;
  intervalMs: number;
}

export class DueHeap {
  private items: Due[] = [];
  private index = new Map<string, number>();

  get size(): number {
    return this.items.length;
  }

  has(id: string): boolean {
    return this.index.has(id);
  }

  /** Insert, or move an existing entry to a new due time. */
  push(item: Due): void {
    const existing = this.index.get(item.id);
    if (existing !== undefined) {
      this.items[existing] = item;
      this.siftDown(this.siftUp(existing));
      return;
    }
    this.items.push(item);
    this.index.set(item.id, this.items.length - 1);
    this.siftUp(this.items.length - 1);
  }

  peek(): Due | undefined {
    return this.items[0];
  }

  remove(id: string): boolean {
    const i = this.index.get(id);
    if (i === undefined) return false;
    const last = this.items.pop()!;
    this.index.delete(id);
    if (i < this.items.length) {
      this.items[i] = last;
      this.index.set(last.id, i);
      this.siftDown(this.siftUp(i));
    }
    return true;
  }

  /** Pop every entry due at or before `now`, cheapest-first. */
  popDue(now: number, max = Infinity): Due[] {
    const out: Due[] = [];
    while (this.items.length && this.items[0].dueAt <= now && out.length < max) {
      const top = this.items[0];
      this.remove(top.id);
      out.push(top);
    }
    return out;
  }

  private swap(a: number, b: number): void {
    [this.items[a], this.items[b]] = [this.items[b], this.items[a]];
    this.index.set(this.items[a].id, a);
    this.index.set(this.items[b].id, b);
  }

  private siftUp(i: number): number {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.items[parent].dueAt <= this.items[i].dueAt) break;
      this.swap(i, parent);
      i = parent;
    }
    return i;
  }

  private siftDown(i: number): number {
    for (;;) {
      const l = 2 * i + 1;
      const r = l + 1;
      let smallest = i;
      if (l < this.items.length && this.items[l].dueAt < this.items[smallest].dueAt) smallest = l;
      if (r < this.items.length && this.items[r].dueAt < this.items[smallest].dueAt) smallest = r;
      if (smallest === i) return i;
      this.swap(i, smallest);
      i = smallest;
    }
  }
}

/**
 * Advance a due time by exactly one interval, on a fixed grid.
 *
 * `dueAt + interval`, never `now + interval`: the latter lets a slow probe
 * push the next check later and later, until a monitor configured for five
 * minutes is quietly running every six.
 *
 * The catch-up cap handles the other direction. After a restart or a long
 * pause the grid is far in the past, and replaying every missed check at once
 * would stampede the pool with results nobody wants. Skip forward instead.
 */
export function nextDueAt(previousDueAt: number, intervalMs: number, now: number): number {
  const advanced = previousDueAt + intervalMs;
  if (advanced > now) return advanced;
  if (now - previousDueAt > 2 * intervalMs) return now + intervalMs; // too far behind
  return advanced;
}

/**
 * Spread a monitor's first check deterministically across its interval.
 *
 * Without this every five-minute monitor in the fleet fires on the same
 * second — the pool queues behind itself and response times measure our own
 * congestion rather than the customer's endpoint. Hashing the id keeps the
 * offset stable across restarts, so the spread does not reshuffle on deploy.
 */
export function initialDueAt(monitorId: string, intervalMs: number, now: number): number {
  let hash = 2166136261;
  for (let i = 0; i < monitorId.length; i++) {
    hash ^= monitorId.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const offset = Math.abs(hash) % Math.max(1, intervalMs);
  return now + offset;
}
