import { initializeApp, getApps, cert, applicationDefault } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getAuth, type Auth } from "firebase-admin/auth";
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

export function db(): Firestore {
  return getFirestore(ensureApp());
}

export function auth(): Auth {
  return getAuth(ensureApp());
}

export const col = {
  orgs: () => db().collection("orgs"),
  users: () => db().collection("users"),
  monitors: () => db().collection("monitors"),
  orgStatus: () => db().collection("orgStatus"),
  incidents: () => db().collection("incidents"),
  alertContacts: () => db().collection("alertContacts"),
  statusPages: () => db().collection("statusPages"),
};
