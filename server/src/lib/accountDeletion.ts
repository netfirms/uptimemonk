import { auth, col } from "../sync/firebase.js";
import { deleteOrg } from "../db/repo.js";
import { log } from "./log.js";

/**
 * Delete an account and everything belonging to it.
 *
 * Shared by the operator console and by the self-service route the app calls,
 * because two implementations of "delete everything" is how one of them ends
 * up missing a collection. The self-service path exists because the App Store
 * requires it: an app that creates accounts must let someone delete theirs
 * from inside the app (Guideline 5.1.1(v)), and pointing at a web page or an
 * email address does not satisfy it.
 *
 * **Order is deliberate.** Firestore first, then the worker's SQLite, then the
 * Auth account last. A failure part-way therefore leaves an account that can
 * still sign in and retry, rather than an orphaned pile of data belonging to a
 * user who no longer exists and cannot ask about it.
 *
 * Deleting through the Admin SDK also sidesteps Firebase's
 * `requires-recent-login`, which client-side `user.delete()` raises for anyone
 * whose session is more than a few minutes old — the single most common reason
 * an in-app delete button appears to work and does not.
 */

export interface DeletionResult {
  uid: string;
  orgId: string | null;
  firestoreDocs: number;
  monitors: number;
  contacts: number;
  ledger: number;
  feedback: number;
}

/** Deletes in pages: a Firestore batch caps at 500 writes. */
async function deleteQuery(query: FirebaseFirestore.Query): Promise<number> {
  const snap = await query.get();
  for (let i = 0; i < snap.docs.length; i += 400) {
    const batch = col.orgs().firestore.batch();
    snap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  return snap.size;
}

/**
 * Other members of the workspace, excluding [uid].
 *
 * Deleting an owner would strand them: their monitors would vanish under them
 * with no warning and no way to object.
 */
export async function otherMembersOf(orgId: string, uid: string): Promise<number> {
  const members = await col.users().where("orgId", "==", orgId).get();
  return members.docs.filter((d) => d.id !== uid).length;
}

export async function findOwnedOrg(uid: string): Promise<string | null> {
  const snap = await col.orgs().where("ownerUid", "==", uid).get();
  return snap.empty ? null : snap.docs[0].id;
}

export async function deleteAccountAndData(
  uid: string,
  reason: "self-service" | "operator",
  by?: string
): Promise<DeletionResult> {
  const orgId = await findOwnedOrg(uid);

  let firestoreDocs = 0;
  if (orgId) {
    for (const query of [
      col.monitors().where("orgId", "==", orgId),
      col.incidents().where("orgId", "==", orgId),
      col.alertContacts().where("orgId", "==", orgId),
      col.statusPages().where("orgId", "==", orgId),
      col.statusSlugs().where("orgId", "==", orgId),
    ]) {
      firestoreDocs += await deleteQuery(query);
    }

    await col.orgStatus().doc(orgId).delete();
    await col.orgs().doc(orgId).delete();
    firestoreDocs += 2;
  }

  await col.users().doc(uid).delete();
  firestoreDocs += 1;

  // Feedback carries the sender's address and whatever they wrote, so it is
  // their personal data and goes with the account. Keyed on uid, so a message
  // sent before signing in — which has no uid — is not matched and survives as
  // anonymous. That is the correct outcome: it is no longer attributable.
  const feedback = await deleteQuery(col.feedback().where("uid", "==", uid));

  // Then the worker's own tables, which nothing upstream describes.
  const removed = orgId ? deleteOrg(orgId) : { monitors: 0, contacts: 0, ledger: 0 };

  // The account last, so a failure above leaves something recoverable.
  await auth().deleteUser(uid);

  const result: DeletionResult = {
    uid,
    orgId,
    firestoreDocs,
    feedback,
    ...removed,
  };

  log.warn({ ...result, reason, by }, "account deleted");
  return result;
}
