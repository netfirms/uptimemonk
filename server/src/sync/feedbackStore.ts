import { col } from "./firebase.js";
import type { Feedback, FeedbackKind, FeedbackStatus } from "../types.js";

/**
 * Feedback storage, in Firestore.
 *
 * This is the deliberate exception to "the worker owns its data in SQLite".
 * That rule exists because check results arrive thousands per minute and are
 * regenerable — lose an hour and the next probe rebuilds it. Feedback is the
 * opposite on both counts: a handful a day, and gone forever if the disk
 * goes, because a person typed it once.
 *
 * The probe box's SQLite file has no off-box backup (Litestream is installed
 * and inactive), so the one category of irreplaceable human-authored data in
 * this system does not belong on it.
 *
 * Everything here goes through the Admin SDK, which bypasses security rules.
 * The rules deny the client both read and write: a signed-in user reading this
 * collection would see every other user's message and email address.
 */

/** Epoch ms in a plain number field, matching how the rest of the system stores time. */
function toFeedback(id: string, d: FirebaseFirestore.DocumentData): Feedback {
  return {
    id,
    createdAt: typeof d.createdAt === "number" ? d.createdAt : 0,
    kind: (d.kind ?? "other") as FeedbackKind,
    message: d.message ?? "",
    email: d.email ?? "",
    name: d.name ?? "",
    uid: d.uid ?? null,
    orgId: d.orgId ?? null,
    source: d.source ?? "web",
    appVersion: d.appVersion ?? null,
    status: (d.status ?? "new") as FeedbackStatus,
    operatorNote: d.operatorNote ?? "",
  };
}

export async function insertFeedback(input: {
  kind: FeedbackKind;
  message: string;
  email: string;
  name?: string;
  uid?: string | null;
  orgId?: string | null;
  source?: string;
  appVersion?: string | null;
}): Promise<Feedback> {
  const doc = {
    createdAt: Date.now(),
    kind: input.kind,
    message: input.message,
    email: input.email,
    name: input.name ?? "",
    uid: input.uid ?? null,
    orgId: input.orgId ?? null,
    source: input.source ?? "web",
    appVersion: input.appVersion ?? null,
    status: "new" as FeedbackStatus,
    operatorNote: "",
  };
  const ref = await col.feedback().add(doc);
  return toFeedback(ref.id, doc);
}

/**
 * True when this exact message has already arrived from this address recently.
 *
 * Narrows to one address in the query and compares the text in memory. The
 * `orderBy` is load-bearing rather than tidiness: without it `limit(10)`
 * returns an arbitrary ten documents, so a sender with a long history could
 * resubmit and have the duplicate missed. It costs a composite index on
 * (email, createdAt) — declared in `firestore.indexes.json`, and without it
 * this query fails with FAILED_PRECONDITION rather than degrading.
 */
export async function isDuplicateFeedback(
  email: string,
  message: string,
  withinMs: number
): Promise<boolean> {
  const snap = await col
    .feedback()
    .where("email", "==", email)
    .orderBy("createdAt", "desc")
    .limit(10)
    .get();
  return hasRecentMatch(
    snap.docs.map((d) => ({
      createdAt: d.get("createdAt") as number,
      message: d.get("message") as string,
    })),
    message,
    Date.now() - withinMs
  );
}

/**
 * The in-memory half of the duplicate check, exported so it can be tested
 * without a Firestore.
 *
 * The query already narrows to one email address; this decides whether any of
 * those recent messages is the same text inside the window.
 */
export function hasRecentMatch(
  recent: { createdAt: number; message: string }[],
  message: string,
  since: number
): boolean {
  return recent.some((r) => r.createdAt > since && r.message === message);
}

export async function listFeedback(
  opts: { status?: FeedbackStatus; limit?: number } = {}
): Promise<Feedback[]> {
  const limit = Math.min(Math.max(opts.limit ?? 200, 1), 500);

  if (opts.status) {
    const snap = await col
      .feedback()
      .where("status", "==", opts.status)
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();
    return snap.docs.map((d) => toFeedback(d.id, d.data()));
  }

  // Unhandled first, then newest. Firestore cannot order by a computed
  // expression the way SQLite can, so the sort happens here — bounded by
  // `limit`, which is at most 500 documents.
  const snap = await col.feedback().orderBy("createdAt", "desc").limit(limit).get();
  return sortInbox(snap.docs.map((d) => toFeedback(d.id, d.data())));
}

/**
 * Unhandled first, then newest — the order an operator reads in.
 *
 * Exported and pure because Firestore cannot order by a computed expression
 * the way SQLite's `ORDER BY (status = 'new') DESC` could, so this is now real
 * logic rather than a clause in a query, and real logic gets a test.
 */
export function sortInbox(messages: Feedback[]): Feedback[] {
  return [...messages].sort((a, b) => {
    if (a.status === "new" && b.status !== "new") return -1;
    if (b.status === "new" && a.status !== "new") return 1;
    return b.createdAt - a.createdAt;
  });
}

/**
 * Counts per status.
 *
 * Firestore's aggregation `count()` bills one read per 1,000 documents matched
 * rather than one per document, which is what makes three of these cheap
 * enough to run on every inbox load.
 */
export async function countFeedbackByStatus(): Promise<Record<FeedbackStatus, number>> {
  const statuses: FeedbackStatus[] = ["new", "read", "archived"];
  const results = await Promise.all(
    statuses.map((s) => col.feedback().where("status", "==", s).count().get())
  );
  const out: Record<FeedbackStatus, number> = { new: 0, read: 0, archived: 0 };
  statuses.forEach((s, i) => {
    out[s] = results[i].data().count;
  });
  return out;
}

/** False when the document does not exist, so the route can 404 honestly. */
export async function updateFeedback(
  id: string,
  patch: { status?: FeedbackStatus; operatorNote?: string }
): Promise<boolean> {
  const ref = col.feedback().doc(id);
  const snap = await ref.get();
  if (!snap.exists) return false;
  if (Object.keys(patch).length === 0) return true;
  await ref.update(patch);
  return true;
}

export async function deleteFeedback(id: string): Promise<boolean> {
  const ref = col.feedback().doc(id);
  const snap = await ref.get();
  if (!snap.exists) return false;
  await ref.delete();
  return true;
}
