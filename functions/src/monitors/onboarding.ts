import { beforeUserCreated } from "firebase-functions/v2/identity";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { randomBytes, createHash } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { db, col } from "../lib/firestore";
import { limitsFor } from "../lib/plans";
import { MAX_API_KEYS_PER_ORG, PRIMARY_REGION } from "../config";
import type { AlertContact, Org } from "../types";

/**
 * Every new user gets an org and a verified email alert contact, and a custom
 * claim carrying their orgId + role. The claim is what Firestore rules read, so
 * a rule never has to do a lookup — that keeps rules fast and free.
 */
export const bootstrapUser = beforeUserCreated(
  { region: PRIMARY_REGION },
  async (event) => {
    const user = event.data;
    if (!user) return;

    const orgRef = col.orgs().doc();
    const org: Org = {
      name: user.email?.split("@")[0] ?? "My workspace",
      ownerUid: user.uid,
      plan: "free",
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      subscriptionStatus: null,
      currentPeriodEnd: null,
      createdAt: Timestamp.now(),
    };

    const batch = db.batch();
    batch.set(orgRef, org);
    batch.set(db.collection("users").doc(user.uid), {
      email: user.email ?? null,
      displayName: user.displayName ?? null,
      orgId: orgRef.id,
      role: "owner",
      createdAt: Timestamp.now(),
    });
    if (user.email) {
      const contact: AlertContact = {
        orgId: orgRef.id,
        channel: "email",
        name: user.email,
        destination: user.email,
        enabled: true,
        verified: true, // they signed up with it
        createdAt: Timestamp.now(),
      };
      batch.set(col.alertContacts().doc(), contact);
    }
    await batch.commit();

    return {
      customClaims: { orgId: orgRef.id, role: "owner" },
    };
  }
);

/** Issues an API key. The plaintext is shown once and never stored. */
export const createApiKey = onCall({ region: PRIMARY_REGION }, async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in first");
  const orgId = req.auth.token.orgId as string | undefined;
  if (!orgId) throw new HttpsError("failed-precondition", "No organisation on token");

  const org = (await col.orgs().doc(orgId).get()).data() as Org | undefined;
  const limits = limitsFor(org?.plan);
  if (!limits.apiAccess) {
    throw new HttpsError(
      "permission-denied",
      `API access is not included in the ${limits.label} plan`
    );
  }
  const keyCount = await col.apiKeys().where("orgId", "==", orgId).count().get();
  if (keyCount.data().count >= MAX_API_KEYS_PER_ORG) {
    throw new HttpsError(
      "resource-exhausted",
      `An organisation may hold at most ${MAX_API_KEYS_PER_ORG} API keys`
    );
  }

  const plaintext = `um_live_${randomBytes(24).toString("base64url")}`;
  await col.apiKeys().add({
    orgId,
    hash: createHash("sha256").update(plaintext).digest("hex"),
    prefix: plaintext.slice(0, 16),
    name: (req.data?.name as string) ?? "Default key",
    createdBy: req.auth.uid,
    createdAt: Timestamp.now(),
    lastUsedAt: null,
    revoked: false,
  });

  return { key: plaintext };
});

/** Invite a teammate: grants them the same orgId claim. */
export const inviteMember = onCall({ region: PRIMARY_REGION }, async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in first");
  if (req.auth.token.role !== "owner") {
    throw new HttpsError("permission-denied", "Only owners can invite");
  }
  const { email, role } = req.data as { email: string; role: "admin" | "member" };
  const orgId = req.auth.token.orgId as string;

  const user = await getAuth().getUserByEmail(email).catch(() => null);
  if (!user) throw new HttpsError("not-found", "That user has not signed up yet");

  // setCustomUserClaims REPLACES the whole claim object, so read first and
  // merge. Blindly overwriting also used to move a user who already owned
  // their own workspace into this one, silently cutting them off from their
  // own monitors — refuse that outright rather than doing it quietly.
  const existing = (user.customClaims ?? {}) as Record<string, unknown>;
  if (existing.orgId && existing.orgId !== orgId) {
    throw new HttpsError(
      "failed-precondition",
      "That user already belongs to another workspace. They must leave it first."
    );
  }

  const nextRole = role ?? "member";
  await getAuth().setCustomUserClaims(user.uid, {
    ...existing,
    orgId,
    role: nextRole,
  });
  await db
    .collection("users")
    .doc(user.uid)
    .set({ orgId, role: nextRole }, { merge: true });
  return { ok: true };
});
