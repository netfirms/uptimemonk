import { test, describe } from "node:test";
import assert from "node:assert/strict";
import type { Feedback, FeedbackStatus } from "../types.js";
import { sortInbox, hasRecentMatch } from "./feedbackStore.js";

/**
 * The two decisions that moved out of the database when feedback moved to
 * Firestore.
 *
 * SQLite made both of these a clause — `ORDER BY (status = 'new') DESC` and a
 * `WHERE ... AND ... AND created_at >` — so they were the database's problem
 * and were covered by exercising it. Firestore cannot order by a computed
 * expression, so both are now real code in this process, and real code gets
 * tested. The Firestore round-trip itself is not mocked: that would assert the
 * Admin SDK can write a document, which is not in doubt and not what breaks.
 */

function msg(over: Partial<Feedback> & { id: string }): Feedback {
  return {
    createdAt: 1_000,
    kind: "suggestion",
    message: "a message",
    email: "someone@example.com",
    name: "",
    uid: null,
    orgId: null,
    source: "web",
    appVersion: null,
    status: "new" as FeedbackStatus,
    operatorNote: "",
    ...over,
  };
}

describe("sortInbox", () => {
  test("unhandled messages come before handled ones", () => {
    // Even when the handled one is newer: an operator is working through what
    // has not been dealt with, and burying a new message under yesterday's
    // answered ones is how it gets missed.
    const out = sortInbox([
      msg({ id: "read-and-newest", status: "read", createdAt: 9_000 }),
      msg({ id: "new-but-older", status: "new", createdAt: 1_000 }),
    ]);
    assert.deepEqual(out.map((m) => m.id), ["new-but-older", "read-and-newest"]);
  });

  test("within the same handled-ness, newest first", () => {
    const out = sortInbox([
      msg({ id: "old", status: "new", createdAt: 1_000 }),
      msg({ id: "newest", status: "new", createdAt: 3_000 }),
      msg({ id: "middle", status: "new", createdAt: 2_000 }),
    ]);
    assert.deepEqual(out.map((m) => m.id), ["newest", "middle", "old"]);
  });

  test("read and archived rank together — only 'new' is special", () => {
    // The distinction that matters is handled vs not. Sorting archived below
    // read would bury an archived message an operator deliberately reopened.
    const out = sortInbox([
      msg({ id: "archived-new", status: "archived", createdAt: 5_000 }),
      msg({ id: "read-old", status: "read", createdAt: 2_000 }),
    ]);
    assert.deepEqual(out.map((m) => m.id), ["archived-new", "read-old"]);
  });

  test("does not mutate its input", () => {
    // The caller hands us the array straight from a Firestore snapshot map;
    // sorting in place would be a surprise for anything that reused it.
    const input = [
      msg({ id: "a", status: "read", createdAt: 9_000 }),
      msg({ id: "b", status: "new", createdAt: 1_000 }),
    ];
    sortInbox(input);
    assert.deepEqual(input.map((m) => m.id), ["a", "b"]);
  });

  test("an empty inbox sorts to an empty inbox", () => {
    assert.deepEqual(sortInbox([]), []);
  });
});

describe("hasRecentMatch", () => {
  const RECENT = [
    { createdAt: 5_000, message: "The chart is blank on Safari." },
    { createdAt: 4_000, message: "Please add environment grouping." },
  ];

  test("the same text inside the window is a duplicate", () => {
    assert.equal(hasRecentMatch(RECENT, "The chart is blank on Safari.", 1_000), true);
  });

  test("different text is not a duplicate", () => {
    assert.equal(hasRecentMatch(RECENT, "Something else entirely.", 1_000), false);
  });

  test("the same text outside the window is not a duplicate", () => {
    // Someone raising the same issue a week later is telling you it is still
    // broken, which is a second report and not a stray double-click.
    assert.equal(hasRecentMatch(RECENT, "The chart is blank on Safari.", 6_000), false);
  });

  test("the comparison is exact, not fuzzy", () => {
    // Deliberate: a sender who edited a word meant to send something new.
    assert.equal(hasRecentMatch(RECENT, "the chart is blank on safari.", 1_000), false);
    assert.equal(hasRecentMatch(RECENT, "The chart is blank on Safari", 1_000), false);
  });

  test("nothing recent means nothing is a duplicate", () => {
    assert.equal(hasRecentMatch([], "anything at all here", 0), false);
  });
});
