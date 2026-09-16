/**
 * Seed a demo org + monitors. Run against the emulator first:
 *
 *   FIRESTORE_EMULATOR_HOST=localhost:8080 \
 *   GOOGLE_CLOUD_PROJECT=uptimemonk-dev \
 *   node scripts/seed.mjs
 *
 * Against production, set GOOGLE_APPLICATION_CREDENTIALS to a service-account
 * key instead and drop FIRESTORE_EMULATOR_HOST.
 */
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { randomBytes } from "node:crypto";

// Against the emulator there is no credential at all: passing the key with an
// undefined value is rejected outright by firebase-admin, so omit it entirely.
initializeApp({
  projectId: process.env.GOOGLE_CLOUD_PROJECT ?? "uptimemonk-dev",
  ...(process.env.FIRESTORE_EMULATOR_HOST
    ? {}
    : { credential: applicationDefault() }),
});
const db = getFirestore();
const now = Timestamp.now();

const orgRef = db.collection("orgs").doc("demo-org");
await orgRef.set({
  name: "Demo",
  ownerUid: "demo-uid",
  plan: "team",
  createdAt: now,
});

const contactRef = db.collection("alertContacts").doc("demo-email");
await contactRef.set({
  orgId: orgRef.id,
  channel: "email",
  name: "Ops inbox",
  destination: "ops@example.com",
  enabled: true,
  verified: true,
  createdAt: now,
});

const base = {
  orgId: orgRef.id,
  intervalSeconds: 300,
  timeoutSeconds: 10,
  confirmationThreshold: 2,
  regions: ["asia-southeast1", "europe-west1"],
  enabled: true,
  alertContactIds: [contactRef.id],
  status: "pending",
  consecutiveFailures: 0,
  nextCheckAt: now,
  createdAt: now,
  updatedAt: now,
};

const monitors = [
  { ...base, name: "Marketing site", type: "http", target: "https://example.com" },
  {
    ...base,
    name: "API health",
    type: "keyword",
    target: "https://httpbin.org/json",
    keyword: "slideshow",
    method: "GET",
  },
  { ...base, name: "Postgres", type: "tcp", target: "db.example.com", port: 5432 },
  { ...base, name: "TLS cert", type: "ssl", target: "example.com", sslExpiryWarningDays: 21 },
  {
    ...base,
    name: "MX records",
    type: "dns",
    target: "example.com",
    dnsRecordType: "MX",
  },
  {
    ...base,
    name: "Nightly backup",
    type: "heartbeat",
    target: "",
    heartbeatToken: randomBytes(16).toString("hex"),
    heartbeatGraceSeconds: 90 * 60,
    intervalSeconds: 86400,
  },
];

for (const m of monitors) {
  const ref = await db.collection("monitors").add(m);
  console.log(`created ${m.type.padEnd(9)} ${m.name}  (${ref.id})`);
  if (m.heartbeatToken) console.log(`   heartbeat token: ${m.heartbeatToken}`);
}

await db.collection("statusPages").doc("demo-status").set({
  orgId: orgRef.id,
  slug: "demo",
  title: "Demo Systems",
  description: "Live status of our public services.",
  monitorIds: [],
  showResponseTimes: true,
  published: true,
});

console.log("\nSeed complete. Add monitor ids to statusPages/demo-status.monitorIds to populate the status page.");
process.exit(0);
