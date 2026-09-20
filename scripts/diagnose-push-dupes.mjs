/**
 * Read-only diagnostic: why do FCM push contacts duplicate in Settings?
 *
 * Groups every `alertContacts` doc by channel, and for `fcm` rows shows the
 * token prefix, platform, uid and name so we can tell whether duplicates are
 * distinct tokens (device re-registering) or the same token written twice.
 *
 * Defaults to the dev project, like the other scripts here. To inspect
 * production deliberately:
 *
 *   GOOGLE_CLOUD_PROJECT=uptimemonk \
 *   GOOGLE_APPLICATION_CREDENTIALS=creds/sa.json \
 *   node scripts/diagnose-push-dupes.mjs
 *
 * Nothing here writes: every call is a read, and tokens are printed truncated
 * so a full device token never reaches a terminal or a log file.
 */
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

initializeApp({
  projectId: process.env.GOOGLE_CLOUD_PROJECT ?? "uptimemonk-dev",
  credential: process.env.FIRESTORE_EMULATOR_HOST ? undefined : applicationDefault(),
});
const db = getFirestore();

const snap = await db.collection("alertContacts").get();

const byOrg = new Map();
const byChannel = new Map();

for (const d of snap.docs) {
  const c = d.data();
  const chan = String(c.channel ?? "?");
  byChannel.set(chan, (byChannel.get(chan) ?? 0) + 1);

  if (chan !== "fcm") continue;

  const org = String(c.orgId ?? "?");
  if (!byOrg.has(org)) byOrg.set(org, []);
  byOrg.get(org).push({
    id: d.id,
    token: String(c.destination ?? ""),
    uid: c.uid ?? null,
    platform: c.platform ?? null,
    name: c.name ?? null,
    enabled: c.enabled !== false,
    verified: c.verified === true,
    createdAt: c.createdAt?.toMillis?.() ?? null,
    updatedAt: c.updatedAt?.toMillis?.() ?? null,
  });
}

console.log("=== contact counts by channel ===");
for (const [chan, n] of [...byChannel].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${chan.padEnd(10)} ${n}`);
}

console.log("\n=== fcm contacts by org ===");
for (const [org, rows] of byOrg) {
  const distinctTokens = new Set(rows.map((r) => r.token));
  const distinctUids = new Set(rows.map((r) => r.uid));
  console.log(`\norg ${org}: ${rows.length} fcm rows, ${distinctTokens.size} distinct token(s), ${distinctUids.size} uid(s)`);

  for (const r of rows) {
    const ts = r.createdAt ? new Date(r.createdAt).toISOString() : "?";
    console.log(
      `  ${r.id}  token=${r.token.slice(0, 12)}…  uid=${r.uid}  ` +
        `plat=${r.platform}  verified=${r.verified}  enabled=${r.enabled}\n` +
        `      name="${r.name}"  created=${ts}`
    );
  }

  // Flag identical tokens written as separate docs - the true duplicate case.
  const seen = new Map();
  for (const r of rows) {
    if (seen.has(r.token)) {
      console.log(`  !! SAME TOKEN in two docs: ${seen.get(r.token)} and ${r.id}`);
    }
    seen.set(r.token, r.id);
  }
}

if (!byOrg.size) console.log("(no fcm contacts found)");
process.exit(0);
