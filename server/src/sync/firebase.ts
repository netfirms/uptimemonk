import { initializeApp, getApps, cert, applicationDefault } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getMessaging, type Messaging } from "firebase-admin/messaging";
import { googleCredentials } from "../config.js";

/**
 * The single Firebase entry point for a worker.
 *
 * The service account behind this should hold `roles/datastore.user` and
 * nothing else — not Editor, not the default compute account. The key is
 * handed over by systemd's LoadCredential, so it never appears in an
 * environment block that a process listing can read.
 */
let app: ReturnType<typeof initializeApp> | null = null;

function ensureApp() {
  if (app) return app;
  if (getApps().length) {
    app = getApps()[0];
    return app;
  }

  const { projectId, credential } = googleCredentials();
  app = initializeApp({
    projectId,
    credential: credential ? cert(credential as never) : applicationDefault(),
  });
  return app;
}

let customDb: Firestore | null = null;

export function setCustomDb(mock: Firestore | null): void {
  customDb = mock;
}

export function db(): Firestore {
  if (customDb) return customDb;
  return getFirestore(ensureApp());
}

let customAuth: Auth | null = null;

export function setCustomAuth(mock: Auth | null): void {
  customAuth = mock;
}

export function auth(): Auth {
  if (customAuth) return customAuth;
  return getAuth(ensureApp());
}

let customMessaging: Messaging | null = null;

export function setCustomMessaging(mock: Messaging | null): void {
  customMessaging = mock;
}

export function messaging(): Messaging {
  if (customMessaging) return customMessaging;
  return getMessaging(ensureApp());
}

export const col = {
  orgs: () => db().collection("orgs"),
  users: () => db().collection("users"),
  monitors: () => db().collection("monitors"),
  orgStatus: () => db().collection("orgStatus"),
  incidents: () => db().collection("incidents"),
  alertContacts: () => db().collection("alertContacts"),
  statusPages: () => db().collection("statusPages"),
  /**
   * Slug -> orgId, with the slug as the document id.
   *
   * Firestore has no unique index, so uniqueness has to be something the
   * database can actually enforce. A document id is exactly that: two
   * workspaces cannot both create `statusSlugs/acme`, and a transaction makes
   * the check-and-claim atomic instead of a race.
   */
  statusSlugs: () => db().collection("statusSlugs"),
  /** Applied Stripe event ids, so a retry cannot grant twice. */
  stripeEvents: () => db().collection("stripeEvents"),
  /**
   * subscription id -> orgId, captured from a Checkout session.
   *
   * A Payment Link puts the workspace in `client_reference_id` on the
   * *session*; it never reaches the subscription, and later renewals only
   * carry the subscription. Without this mapping a recurring donation is
   * received every month and credited to nobody.
   */
  stripeSubs: () => db().collection("stripeSubs"),
  /** System-wide application configuration managed from admin console. */
  system: () => db().collection("system"),
};
