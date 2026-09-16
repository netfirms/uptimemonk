import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { ownsOrg, orgsMovedBy, shardFor } from "./assignment.js";

const orgs = Array.from({ length: 500 }, (_, i) => `org-${i}`);
const worker = (index: number, count: number, region = "ap-southeast-1") => ({
  region,
  index,
  count,
});

describe("shardFor", () => {
  test("a single worker owns everything", () => {
    for (const id of orgs) assert.equal(shardFor(id, 1), 0);
  });

  test("is stable — the same org always lands on the same worker", () => {
    for (const id of orgs) assert.equal(shardFor(id, 4), shardFor(id, 4));
  });

  test("stays inside the pool", () => {
    for (const count of [1, 2, 3, 5, 8]) {
      for (const id of orgs) {
        const shard = shardFor(id, count);
        assert.ok(shard >= 0 && shard < count, `${id} -> ${shard} of ${count}`);
      }
    }
  });

  test("spreads roughly evenly, so no worker carries the fleet", () => {
    const count = 4;
    const load = new Array(count).fill(0);
    for (const id of orgs) load[shardFor(id, count)]++;

    const expected = orgs.length / count;
    for (const n of load) {
      // Generous bound: this asserts the hash is not degenerate, not that it
      // is perfectly uniform.
      assert.ok(n > expected * 0.5, `a worker got only ${n} of ~${expected} orgs`);
      assert.ok(n < expected * 1.5, `a worker got ${n} of ~${expected} orgs`);
    }
  });
});

describe("ownsOrg", () => {
  test("every org is owned by exactly one worker in the pool", () => {
    // The invariant that matters: miss it and a monitor is probed twice, or
    // silently not at all.
    for (const count of [1, 2, 3, 4, 7]) {
      for (const id of orgs) {
        const owners = Array.from({ length: count }, (_, i) =>
          ownsOrg(id, undefined, worker(i, count))
        ).filter(Boolean);
        assert.equal(owners.length, 1, `${id} had ${owners.length} owners of ${count}`);
      }
    }
  });

  test("a worker ignores monitors homed in another region", () => {
    assert.equal(ownsOrg("org-1", "eu-west-1", worker(0, 1, "ap-southeast-1")), false);
    assert.equal(ownsOrg("org-1", "ap-southeast-1", worker(0, 1, "ap-southeast-1")), true);
  });

  test("a monitor with no home region is served by its region's pool", () => {
    // Single-region deployments should need no configuration at all.
    const owners = orgs.filter((id) => ownsOrg(id, undefined, worker(0, 1)));
    assert.equal(owners.length, orgs.length);
  });

  test("regions shard independently", () => {
    // The same org can be owned by index 0 in one region and index 2 in
    // another; region is a filter, not part of the hash.
    const sg = orgs.filter((id) => ownsOrg(id, "ap-southeast-1", worker(1, 3, "ap-southeast-1")));
    const eu = orgs.filter((id) => ownsOrg(id, "eu-west-1", worker(1, 3, "eu-west-1")));
    assert.deepEqual(sg, eu, "same shard maths, different vantage point");
  });
});

describe("orgsMovedBy", () => {
  test("nothing moves when the pool size is unchanged", () => {
    assert.deepEqual(orgsMovedBy(orgs, 3, 3), []);
  });

  test("scaling up moves some orgs but not most of them", () => {
    const moved = orgsMovedBy(orgs, 2, 3);
    assert.ok(moved.length > 0, "a rebalance does move work");
    assert.ok(
      moved.length < orgs.length,
      "and it does not move everything — modulo reshuffles, it does not randomise"
    );
  });

  test("reports exactly the orgs whose owner changes", () => {
    const moved = new Set(orgsMovedBy(orgs, 2, 4));
    for (const id of orgs) {
      const changed = shardFor(id, 2) !== shardFor(id, 4);
      assert.equal(moved.has(id), changed, `${id} reported incorrectly`);
    }
  });
});
