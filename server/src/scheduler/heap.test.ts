import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { DueHeap, initialDueAt, nextDueAt } from "./heap.js";

describe("DueHeap", () => {
  test("pops in due order regardless of insertion order", () => {
    const h = new DueHeap();
    h.push({ id: "c", dueAt: 300, intervalMs: 1000 });
    h.push({ id: "a", dueAt: 100, intervalMs: 1000 });
    h.push({ id: "b", dueAt: 200, intervalMs: 1000 });

    assert.deepEqual(
      h.popDue(1000).map((d) => d.id),
      ["a", "b", "c"]
    );
  });

  test("pops only what is actually due", () => {
    const h = new DueHeap();
    h.push({ id: "now", dueAt: 100, intervalMs: 1000 });
    h.push({ id: "later", dueAt: 5000, intervalMs: 1000 });

    assert.deepEqual(
      h.popDue(1000).map((d) => d.id),
      ["now"]
    );
    assert.equal(h.size, 1, "the future entry stays put");
    assert.equal(h.peek()?.id, "later");
  });

  test("pushing an existing id moves it instead of duplicating", () => {
    const h = new DueHeap();
    h.push({ id: "a", dueAt: 5000, intervalMs: 1000 });
    h.push({ id: "a", dueAt: 100, intervalMs: 1000 });

    assert.equal(h.size, 1, "one entry, not two");
    assert.equal(h.popDue(1000).length, 1);
  });

  test("remove takes an entry out from the middle", () => {
    const h = new DueHeap();
    for (const [id, dueAt] of [["a", 100], ["b", 200], ["c", 300]] as const) {
      h.push({ id, dueAt, intervalMs: 1000 });
    }
    assert.equal(h.remove("b"), true);
    assert.equal(h.remove("nope"), false);
    assert.deepEqual(
      h.popDue(1000).map((d) => d.id),
      ["a", "c"]
    );
  });

  test("stays ordered under churn", () => {
    const h = new DueHeap();
    for (let i = 0; i < 500; i++) {
      h.push({ id: `m${i}`, dueAt: (i * 7919) % 1000, intervalMs: 1000 });
    }
    for (let i = 0; i < 250; i += 2) h.remove(`m${i}`);

    const popped = h.popDue(Infinity).map((d) => d.dueAt);
    const sorted = [...popped].sort((a, b) => a - b);
    assert.deepEqual(popped, sorted, "popped in ascending due order");
  });

  test("an empty heap peeks undefined and pops nothing", () => {
    const h = new DueHeap();
    assert.equal(h.peek(), undefined);
    assert.deepEqual(h.popDue(Date.now()), []);
  });
});

describe("nextDueAt", () => {
  const INTERVAL = 300_000; // 5 minutes

  test("advances on a fixed grid, so slow probes do not cause drift", () => {
    // A check due at t=0 that finished at t=4000 is still next due at 300000,
    // not 304000 — otherwise a 5-minute monitor slowly becomes a 6-minute one.
    assert.equal(nextDueAt(0, INTERVAL, 4_000), INTERVAL);
  });

  test("keeps the grid across many cycles", () => {
    let due = 0;
    for (let i = 0; i < 10; i++) due = nextDueAt(due, INTERVAL, due + 1_500);
    assert.equal(due, 10 * INTERVAL, "no accumulated drift");
  });

  test("skips forward instead of replaying a long backlog", () => {
    // Box was down for an hour. Replaying twelve missed checks at once helps
    // nobody, so schedule one interval out from now.
    const now = 3_600_000;
    assert.equal(nextDueAt(0, INTERVAL, now), now + INTERVAL);
  });

  test("still catches up a single missed slot", () => {
    // Only slightly behind: take the next grid point rather than skipping.
    assert.equal(nextDueAt(0, INTERVAL, INTERVAL + 1_000), INTERVAL);
  });
});

describe("initialDueAt", () => {
  const INTERVAL = 300_000;

  test("is stable for the same id, so deploys do not reshuffle the fleet", () => {
    assert.equal(initialDueAt("abc", INTERVAL, 1000), initialDueAt("abc", INTERVAL, 1000));
  });

  test("always lands inside the first interval", () => {
    for (const id of ["a", "bb", "ccc", "monitor-42", ""]) {
      const due = initialDueAt(id, INTERVAL, 1000);
      assert.ok(due >= 1000 && due < 1000 + INTERVAL, `${id} -> ${due}`);
    }
  });

  test("spreads a fleet rather than bunching it on one second", () => {
    const ids = Array.from({ length: 200 }, (_, i) => `monitor-${i}`);
    const buckets = new Set(
      ids.map((id) => Math.floor((initialDueAt(id, INTERVAL, 0) / INTERVAL) * 20))
    );
    // If every monitor fired together this would be a single bucket.
    assert.ok(buckets.size > 5, `expected spread, got ${buckets.size} buckets`);
  });
});

describe("DueHeap.peekEntry", () => {
  test("exposes the interval an entry was scheduled with", () => {
    // The scheduler needs this to notice a config change: without it,
    // refresh() could not tell that a monitor's interval had changed and the
    // new value was not read until the already-scheduled check fired.
    const h = new DueHeap();
    h.push({ id: "a", dueAt: 5000, intervalMs: 300_000 });

    assert.equal(h.peekEntry("a")?.intervalMs, 300_000);
    assert.equal(h.peekEntry("a")?.dueAt, 5000);
    assert.equal(h.peekEntry("missing"), undefined);
  });

  test("reflects a rewritten entry rather than the original", () => {
    const h = new DueHeap();
    h.push({ id: "a", dueAt: 5000, intervalMs: 3_600_000 });
    h.push({ id: "a", dueAt: 60_000, intervalMs: 60_000 });

    assert.equal(h.size, 1, "rewritten, not duplicated");
    assert.equal(h.peekEntry("a")?.intervalMs, 60_000);
    assert.equal(h.peekEntry("a")?.dueAt, 60_000);
  });
});

describe("rescheduling when the interval changes", () => {
  // The arithmetic refresh() uses. Shortening must take effect now; lengthening
  // must not push out a check that is already due.
  const reschedule = (currentDueAt: number, newIntervalMs: number, now: number) =>
    Math.min(currentDueAt, now + newIntervalMs);

  test("shortening brings the next check forward immediately", () => {
    // Hourly -> every minute, 59 minutes into the current gap. Without this,
    // the change appeared to do nothing for the rest of the hour.
    const now = 60_000;
    const dueAt = reschedule(3_600_000, 60_000, now);
    assert.equal(dueAt, 120_000, "one minute from now, not 59 minutes away");
  });

  test("lengthening leaves an already-scheduled check alone", () => {
    // Every minute -> hourly. The imminent check still happens; only the gap
    // after it grows, so nobody loses coverage at the moment they edit.
    const now = 0;
    assert.equal(reschedule(30_000, 3_600_000, now), 30_000);
  });

  test("never schedules further out than one new interval", () => {
    for (const [due, interval, now] of [
      [10_000_000, 60_000, 0],
      [500, 300_000, 0],
      [0, 60_000, 0],
    ] as const) {
      assert.ok(reschedule(due, interval, now) <= now + interval);
    }
  });
});
