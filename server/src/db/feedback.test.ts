import { test, describe, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.UPTIMEMONK_DB = join(mkdtempSync(join(tmpdir(), "uptimemonk-feedback-")), "t.db");

const { openDb, closeDb, getDb } = await import("./index.js");
const repo = await import("./repo.js");

before(() => openDb());
after(() => {
  closeDb();
  rmSync(process.env.UPTIMEMONK_DB!, { recursive: true, force: true });
});
beforeEach(() => {
  getDb().prepare("DELETE FROM feedback").run();
});

function send(over: Partial<Parameters<typeof repo.insertFeedback>[0]> = {}) {
  return repo.insertFeedback({
    kind: "suggestion",
    message: "It would be good if monitors could be grouped by environment.",
    email: "someone@example.com",
    ...over,
  });
}

describe("feedback storage", () => {
  test("a message round-trips with its sender", () => {
    const f = send({ name: "Sam", uid: "uid-1", orgId: "org-1", source: "mobile" });

    assert.equal(f.kind, "suggestion");
    assert.equal(f.email, "someone@example.com");
    assert.equal(f.name, "Sam");
    assert.equal(f.uid, "uid-1");
    assert.equal(f.source, "mobile");
    assert.equal(f.status, "new", "a new message starts unhandled");
    assert.ok(f.createdAt > 0);
  });

  test("an anonymous message keeps a null uid rather than an empty string", () => {
    // The absence of a uid is the signal that this came from the public form
    // and should be read with more suspicion. An empty string would be truthy
    // in the console and erase that distinction.
    const f = send();
    assert.equal(f.uid, null);
    assert.equal(f.orgId, null);
  });

  test("the inbox puts unhandled messages first, then newest", () => {
    const old = send({ message: "first message from a while ago" });
    const handled = send({ message: "second message already dealt with" });
    const fresh = send({ message: "third message just arrived" });

    repo.updateFeedback(handled.id, { status: "read" });

    const order = repo.listFeedback().map((m) => m.id);
    // Both unhandled ones come before the handled one, newest first.
    assert.deepEqual(order, [fresh.id, old.id, handled.id]);
  });

  test("filtering by status returns only that status", () => {
    const a = send({ message: "message that stays new" });
    const b = send({ message: "message that gets archived" });
    repo.updateFeedback(b.id, { status: "archived" });

    assert.deepEqual(repo.listFeedback({ status: "new" }).map((m) => m.id), [a.id]);
    assert.deepEqual(repo.listFeedback({ status: "archived" }).map((m) => m.id), [b.id]);
  });

  test("counts are reported per status, including zeroes", () => {
    const a = send({ message: "one message about a bug" });
    send({ message: "another message about something else" });
    repo.updateFeedback(a.id, { status: "read" });

    // Zeroes matter: the console renders a badge from this and an absent key
    // would render as undefined rather than 0.
    assert.deepEqual(repo.countFeedbackByStatus(), { new: 1, read: 1, archived: 0 });
  });

  test("an operator note is stored without changing status", () => {
    const f = send();
    repo.updateFeedback(f.id, { operatorNote: "Replied, suggested tags." });

    const [stored] = repo.listFeedback();
    assert.equal(stored.operatorNote, "Replied, suggested tags.");
    assert.equal(stored.status, "new", "a note is not an answer");
  });

  test("updating or deleting an unknown id reports failure rather than lying", () => {
    // The route turns this into a 404. Returning true would report success for
    // a write that did not happen.
    assert.equal(repo.updateFeedback("does-not-exist", { status: "read" }), false);
    assert.equal(repo.deleteFeedback("does-not-exist"), false);
  });

  test("deleting removes the message", () => {
    const f = send();
    assert.equal(repo.deleteFeedback(f.id), true);
    assert.equal(repo.listFeedback().length, 0);
  });
});

describe("duplicate suppression", () => {
  test("the same message from the same address inside the window is a duplicate", () => {
    const msg = "The dashboard chart does not load on Safari 17.";
    send({ message: msg, email: "dup@example.com" });

    assert.equal(
      repo.isDuplicateFeedback("dup@example.com", msg, 10 * 60 * 1000),
      true
    );
  });

  test("a different message from the same address is not a duplicate", () => {
    send({ message: "The dashboard chart does not load.", email: "dup@example.com" });

    assert.equal(
      repo.isDuplicateFeedback("dup@example.com", "Something else entirely here.", 10 * 60 * 1000),
      false
    );
  });

  test("the same message from a different address is not a duplicate", () => {
    // Two colleagues reporting the same bug are two reports, not one.
    const msg = "The dashboard chart does not load on Safari 17.";
    send({ message: msg, email: "first@example.com" });

    assert.equal(repo.isDuplicateFeedback("second@example.com", msg, 10 * 60 * 1000), false);
  });

  test("the window is respected — an old identical message is not a duplicate", () => {
    const msg = "Please add grouping by environment.";
    send({ message: msg, email: "later@example.com" });

    // Zero-width window: nothing can be inside it.
    assert.equal(repo.isDuplicateFeedback("later@example.com", msg, 0), false);
  });
});
