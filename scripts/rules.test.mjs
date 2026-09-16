/**
 * Firestore security-rules tests.
 *
 * These run against the emulator, which must already be up:
 *   npm run emulators        (or: firebase emulators:start --only firestore)
 *   npm run test:rules
 *
 * The rules carry the entire tenancy model — no backend code sits between the
 * dashboard and the database — so "can org A read org B's monitors" is a
 * question only a test can answer honestly.
 */
import { test, describe, before, after, beforeEach } from "node:test";
import { readFileSync } from "node:fs";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";

const ORG_A = "org-a";
const ORG_B = "org-b";

let env;

/** A signed-in member of an org, as the claims a real session would carry. */
const asOrg = (orgId, role = "owner") =>
  env.authenticatedContext(`uid-${orgId}`, { orgId, role }).firestore();

before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-uptimemonk-rules",
    firestore: {
      rules: readFileSync("firestore.rules", "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });
});

after(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  // Seed through an admin context, which bypasses rules — this is the backend.
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "monitors/m1"), {
      orgId: ORG_A,
      name: "Marketing site",
      target: "https://example.com",
      status: "up",
      enabled: true,
      intervalSeconds: 300,
      consecutiveFailures: 0,
      nextCheckAt: new Date(),
    });
    await setDoc(doc(db, "alertContacts/c1"), {
      orgId: ORG_A,
      channel: "email",
      name: "Ops",
      destination: "ops@example.com",
      enabled: true,
      verified: false,
    });
    await setDoc(doc(db, "apiKeys/k1"), { orgId: ORG_A, hash: "deadbeef" });
    await setDoc(doc(db, `orgStatus/${ORG_A}`), {
      orgId: ORG_A,
      monitorCount: 1,
      monitors: { m1: { status: "up", lastResponseTimeMs: 120 } },
    });
    await setDoc(doc(db, "incidents/i1"), {
      orgId: ORG_A,
      monitorId: "m1",
      status: "open",
    });
  });
});

describe("tenancy", () => {
  test("an org reads its own monitor", async () => {
    await assertSucceeds(getDoc(doc(asOrg(ORG_A), "monitors/m1")));
  });

  test("another org cannot read it", async () => {
    await assertFails(getDoc(doc(asOrg(ORG_B), "monitors/m1")));
  });

  test("an anonymous visitor cannot read it", async () => {
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), "monitors/m1")));
  });

  test("API key hashes are readable by nobody", async () => {
    await assertFails(getDoc(doc(asOrg(ORG_A), "apiKeys/k1")));
  });
});

describe("monitor writes", () => {
  test("a client cannot create a monitor directly", async () => {
    // Creation goes through the box API, the only place plan limits and the
    // SSRF target guard are applied.
    await assertFails(
      setDoc(doc(asOrg(ORG_A), "monitors/m2"), {
        orgId: ORG_A,
        name: "Sneaky",
        target: "http://169.254.169.254/",
        enabled: true,
        intervalSeconds: 10,
      })
    );
  });

  test("a client cannot edit a monitor, not even to pause it", async () => {
    // Pause moved to the API too: one write path means the worker learns about
    // every change the same way.
    await assertFails(
      updateDoc(doc(asOrg(ORG_A), "monitors/m1"), {
        enabled: false,
        updatedAt: serverTimestamp(),
      })
    );
    await assertFails(
      updateDoc(doc(asOrg(ORG_A), "monitors/m1"), { intervalSeconds: 10 })
    );
    await assertFails(
      updateDoc(doc(asOrg(ORG_A), "monitors/m1"), {
        target: "http://169.254.169.254/",
      })
    );
  });

  test("a client cannot delete a monitor directly", async () => {
    await assertFails(deleteDoc(doc(asOrg(ORG_A), "monitors/m1")));
  });

  test("check history cannot be forged under a monitor", async () => {
    await assertFails(
      setDoc(doc(asOrg(ORG_A), "monitors/m1/buckets/2026091608"), { up: 999 })
    );
    await assertFails(getDoc(doc(asOrg(ORG_A), "monitors/m1/buckets/2026091608")));
  });
});

describe("status mirror", () => {
  test("an org reads its own status document", async () => {
    await assertSucceeds(getDoc(doc(asOrg(ORG_A), `orgStatus/${ORG_A}`)));
  });

  test("another org cannot read it", async () => {
    await assertFails(getDoc(doc(asOrg(ORG_B), `orgStatus/${ORG_A}`)));
  });

  test("nobody can forge status — a green dashboard must be earned", async () => {
    await assertFails(
      setDoc(doc(asOrg(ORG_A), `orgStatus/${ORG_A}`), {
        orgId: ORG_A,
        monitors: { m1: { status: "up" } },
      })
    );
  });
});

describe("alert contacts", () => {
  // Writes are backend-only, for the same reason as monitors: a Slack,
  // Discord or webhook destination is a URL the server POSTs to from inside
  // our network, and only `targetGuard` can vet it.
  test("a client cannot create a contact directly", async () => {
    await assertFails(
      setDoc(doc(asOrg(ORG_A), "alertContacts/c2"), {
        orgId: ORG_A,
        channel: "webhook",
        name: "Metadata",
        destination: "http://169.254.169.254/latest/meta-data/",
        enabled: true,
        verified: false,
      })
    );
  });

  test("a client cannot verify a contact itself", async () => {
    await assertFails(
      updateDoc(doc(asOrg(ORG_A), "alertContacts/c1"), { verified: true })
    );
  });

  test("a client cannot forge the verification token hash", async () => {
    // Writing the hash would let a caller mint a link for a destination it
    // does not control, which is the same thing as self-verifying.
    await assertFails(
      updateDoc(doc(asOrg(ORG_A), "alertContacts/c1"), {
        verificationTokenHash: "a".repeat(64),
      })
    );
  });

  test("a client cannot rename or delete one either — that is what the API is for", async () => {
    await assertFails(
      updateDoc(doc(asOrg(ORG_A), "alertContacts/c1"), { name: "Ops rota" })
    );
    await assertFails(deleteDoc(doc(asOrg(ORG_A), "alertContacts/c1")));
  });

  test("but an org can still read its own contacts", async () => {
    await assertSucceeds(getDoc(doc(asOrg(ORG_A), "alertContacts/c1")));
  });

  test("and cannot read another org's", async () => {
    await assertFails(getDoc(doc(asOrg(ORG_B), "alertContacts/c1")));
  });
});

describe("incidents", () => {
  test("a user may acknowledge, but not rewrite history", async () => {
    await assertSucceeds(
      updateDoc(doc(asOrg(ORG_A), "incidents/i1"), { acknowledgedBy: "uid-org-a" })
    );
    await assertFails(
      updateDoc(doc(asOrg(ORG_A), "incidents/i1"), { status: "resolved" })
    );
    await assertFails(deleteDoc(doc(asOrg(ORG_A), "incidents/i1")));
  });
});
