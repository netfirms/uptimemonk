/**
 * Remove duplicate push registrations left behind by the device-registration
 * race, and retire tokens a device has rotated away from.
 *
 * Run it read-only first and read the plan before applying:
 *
 *   GOOGLE_CLOUD_PROJECT=uptimemonk \
 *   GOOGLE_APPLICATION_CREDENTIALS=creds/sa.json \
 *   node scripts/dedupe-push-contacts.mjs
 *
 * Then, once the plan is what you expect:
 *
 *   ... node scripts/dedupe-push-contacts.mjs --apply
 *
 * What it does per org:
 *   - keeps the newest fcm row per token, removes the rest (the race's output)
 *   - keeps the newest fcm row per (uid, platform), removes older tokens for
 *     the same device (rotation leftovers)
 *   - never touches a different platform, so an account on both an iPhone and
 *     an Android keeps both
 *   - never touches a non-fcm contact
 *
 * It deletes Firestore documents. It does not touch the worker's SQLite: the
 * config listener re-reads Firestore and a delete there propagates, but the
 * worker must be running for the change to take effect.
 */

const APPLY = process.argv.includes("--apply");

import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const projectId = process.env.GOOGLE_CLOUD_PROJECT ?? "uptimemonk-dev";
initializeApp({
  projectId,
  credential: process.env.FIRESTORE_EMULATOR_HOST ? undefined : applicationDefault(),
});
const db = getFirestore();

const snap = await db.collection("alertContacts").get();

/** orgId -> fcm rows */
const byOrg = new Map();
for (const d of snap.docs) {
  const c = d.data();
  if (c.channel !== "fcm") continue;
  const org = String(c.orgId ?? "");
  if (!byOrg.has(org)) byOrg.set(org, []);
  byOrg.get(org).push({
    ref: d.ref,
    id: d.id,
    token: String(c.destination ?? ""),
    uid: c.uid ?? null,
    platform: c.platform ?? null,
    createdAt: c.createdAt?.toMillis?.() ?? 0,
    name: c.name ?? "",
  });
}

const toDelete = new Map(); // id -> { ref, reason }

for (const [org, rows] of byOrg) {
  // 1. Same token, several rows -> keep newest.
  const newestByToken = new Map();
  for (const r of rows) {
    const prev = newestByToken.get(r.token);
    if (!prev || r.createdAt > prev.createdAt) newestByToken.set(r.token, r);
  }
  for (const r of rows) {
    if (newestByToken.get(r.token)?.id !== r.id) {
      toDelete.set(r.id, { ref: r.ref, reason: "duplicate token" });
    }
  }

  // 2. Same device (uid + platform), older tokens -> keep newest.
  const newestByDevice = new Map();
  for (const r of rows) {
    if (!r.uid || !r.platform) continue;
    const key = `${r.uid}:${r.platform}`;
    const prev = newestByDevice.get(key);
    if (!prev || r.createdAt > prev.createdAt) newestByDevice.set(key, r);
  }
  for (const r of rows) {
    if (!r.uid || !r.platform) continue;
    const key = `${r.uid}:${r.platform}`;
    if (newestByDevice.get(key)?.id !== r.id && !toDelete.has(r.id)) {
      toDelete.set(r.id, { ref: r.ref, reason: "rotated token" });
    }
  }
}

console.log(`project: ${projectId}`);
console.log(`fcm rows scanned: ${[...byOrg.values()].reduce((n, r) => n + r.length, 0)}`);
console.log(`rows to remove: ${toDelete.size}\n`);

for (const [org, rows] of byOrg) {
  const doomed = rows.filter((r) => toDelete.has(r.id));
  if (!doomed.length) continue;
  console.log(`org ${org}  (${rows.length} rows -> ${rows.length - doomed.length})`);
  for (const r of doomed) {
    console.log(
      `  - ${r.id}  token=${r.token.slice(0, 12)}…  ${r.platform}  ` +
        `uid=${r.uid}  [${toDelete.get(r.id).reason}]  "${r.name}"`
    );
  }
}

if (!toDelete.size) {
  console.log("Nothing to do — no duplicates found.");
  process.exit(0);
}

if (!APPLY) {
  console.log(`\nDRY RUN. Re-run with --apply to delete these ${toDelete.size} rows.`);
  process.exit(0);
}

// Firestore batches cap at 500 writes.
const refs = [...toDelete.values()].map((v) => v.ref);
let deleted = 0;
for (let i = 0; i < refs.length; i += 400) {
  const batch = db.batch();
  for (const ref of refs.slice(i, i + 400)) batch.delete(ref);
  await batch.commit();
  deleted += Math.min(400, refs.length - i);
}

console.log(`\nDeleted ${deleted} row(s).`);
process.exit(0);
