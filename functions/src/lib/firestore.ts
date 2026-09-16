import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";

if (getApps().length === 0) {
  initializeApp();
}

export const db: Firestore = getFirestore();
db.settings({ ignoreUndefinedProperties: true });

export const col = {
  orgs: () => db.collection("orgs"),
  monitors: () => db.collection("monitors"),
  monitor: (id: string) => db.collection("monitors").doc(id),
  buckets: (monitorId: string) =>
    db.collection("monitors").doc(monitorId).collection("buckets"),
  days: (monitorId: string) =>
    db.collection("monitors").doc(monitorId).collection("days"),
  incidents: () => db.collection("incidents"),
  alertContacts: () => db.collection("alertContacts"),
  statusPages: () => db.collection("statusPages"),
  apiKeys: () => db.collection("apiKeys"),
  notifications: () => db.collection("notifications"),
};
