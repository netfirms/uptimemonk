import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { decideTransition } from "./stateMachine.js";

const decide = (
  previousStatus: Parameters<typeof decideTransition>[0]["previousStatus"],
  previousFailures: number,
  ok: boolean,
  threshold = 2
) => decideTransition({ previousStatus, previousFailures, ok, threshold });

describe("decideTransition", () => {
  test("a single failure below threshold does not declare an outage", () => {
    const t = decide("up", 0, false);
    assert.equal(t.status, "up", "still up after one failure");
    assert.equal(t.failures, 1);
    assert.equal(t.transitionedDown, false);
  });

  test("reaching the threshold opens exactly one incident", () => {
    const first = decide("up", 1, false); // second consecutive failure
    assert.equal(first.status, "down");
    assert.equal(first.transitionedDown, true);

    // Still failing on the next check — must NOT open a second incident.
    const second = decide("down", 2, false);
    assert.equal(second.status, "down");
    assert.equal(second.transitionedDown, false);
  });

  test("threshold of 1 alerts on the first failure", () => {
    const t = decide("up", 0, false, 1);
    assert.equal(t.status, "down");
    assert.equal(t.transitionedDown, true);
  });

  test("a threshold of 0 or missing is treated as 2, never as instant-alert", () => {
    const t = decide("up", 0, false, 0);
    assert.equal(t.status, "up", "must not page on a single blip");
    assert.equal(decide("up", 1, false, 0).transitionedDown, true);
  });

  test("recovery resolves the incident once, not on every later success", () => {
    const recovery = decide("down", 3, true);
    assert.equal(recovery.status, "up");
    assert.equal(recovery.failures, 0, "failure count resets on success");
    assert.equal(recovery.transitionedUp, true);

    const steady = decide("up", 0, true);
    assert.equal(steady.transitionedUp, false);
  });

  test("a success clears a partial failure streak", () => {
    // One failure, then a success: the next failure starts counting from 1
    // again rather than tipping straight over the threshold.
    assert.equal(decide("up", 1, true).failures, 0);
  });

  test("a brand new monitor stays pending until it has an answer", () => {
    const t = decide("pending", 0, false);
    assert.equal(t.status, "pending");
    assert.equal(t.transitionedDown, false, "no incident before confirmation");
  });

  test("a new monitor's first success goes up without claiming a recovery", () => {
    const t = decide("pending", 0, true);
    assert.equal(t.status, "up");
    assert.equal(t.transitionedUp, false, "nothing was down, so nothing recovered");
  });

  test("a new monitor that keeps failing does eventually alert", () => {
    assert.equal(decide("pending", 1, false).transitionedDown, true);
  });

  test("a paused monitor resuming to a failure behaves like any other", () => {
    assert.equal(decide("paused", 0, false).status, "paused");
    assert.equal(decide("paused", 1, false).transitionedDown, true);
  });

  test("missing previous state is treated as pending, not as up", () => {
    const t = decide(undefined, undefined as unknown as number, false);
    assert.equal(t.status, "pending");
    assert.equal(t.failures, 1);
  });

  test("leaving maintenance while down still resolves the incident", () => {
    // Regression: maintenance used to be a status, so a monitor that was down
    // when a window opened came out as "up" from "maintenance" — never a
    // down -> up transition, so the incident stayed open forever.
    const t = decide("down", 5, true);
    assert.equal(t.transitionedUp, true);
  });
});
