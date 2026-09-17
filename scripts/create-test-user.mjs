import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import fs from "node:fs";
import path from "node:path";

const credsPath = path.resolve("creds/sa.json");
if (!fs.existsSync(credsPath)) {
  console.error("creds/sa.json not found");
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(credsPath, "utf-8"));

const app = initializeApp({
  credential: cert(serviceAccount),
  projectId: "uptimemonk",
});

const auth = getAuth(app);
const db = getFirestore(app);

const EMAIL = process.env.UPTIMEMONK_TEST_EMAIL ?? "jidaso4157@findize.com";
const PASSWORD = process.env.UPTIMEMONK_TEST_PASSWORD ?? "123456";

async function main() {
  let user;
  try {
    user = await auth.getUserByEmail(EMAIL);
    console.log(`Found existing user with uid: ${user.uid}`);
    user = await auth.updateUser(user.uid, {
      password: PASSWORD,
      emailVerified: true,
    });
    console.log(`Updated password and marked emailVerified: true for ${EMAIL}`);
  } catch (err) {
    if (err.code === "auth/user-not-found") {
      console.log(`Creating new user ${EMAIL}...`);
      user = await auth.createUser({
        email: EMAIL,
        password: PASSWORD,
        emailVerified: true,
        displayName: "Automated Tester",
      });
      console.log(`Created user ${EMAIL} with uid: ${user.uid}`);
    } else {
      throw err;
    }
  }

  // Ensure user has an org and custom claims
  const userDocRef = db.collection("users").doc(user.uid);
  const userDoc = await userDocRef.get();

  let orgId = "";
  const now = Timestamp.now();

  if (userDoc.exists && userDoc.data()?.orgId) {
    orgId = userDoc.data().orgId;
    console.log(`User already belongs to org: ${orgId}`);
  } else {
    const orgRef = db.collection("orgs").doc();
    orgId = orgRef.id;
    console.log(`Creating workspace org: ${orgId}`);

    const batch = db.batch();
    batch.set(orgRef, {
      name: "Automate Testing",
      ownerUid: user.uid,
      plan: "free",
      createdAt: now,
    });

    batch.set(userDocRef, {
      email: EMAIL,
      orgId: orgId,
      role: "owner",
      createdAt: now,
    });

    const contactRef = db.collection("alertContacts").doc();
    batch.set(contactRef, {
      orgId: orgId,
      channel: "email",
      name: EMAIL,
      destination: EMAIL,
      enabled: true,
      verified: true,
      createdAt: now,
    });

    await batch.commit();
    console.log(`Created org, user doc, and verified alert contact in Firestore`);
  }

  // Set custom claims
  await auth.setCustomUserClaims(user.uid, {
    orgId,
    role: "owner",
  });
  console.log(`Custom claims set: orgId=${orgId}, role=owner`);

  // Verify sign-in via Firebase Identity Toolkit REST API
  const WEB_KEY = "AIzaSyDBco29lK8EeJ6eD7Rf0JSX2Mqb4yKlRjc";
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${WEB_KEY}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD, returnSecureToken: true }),
    }
  );

  const body = await res.json();
  if (body.error) {
    console.error("Sign-in verification failed:", body.error);
    process.exit(1);
  }

  console.log("Sign-in verification SUCCESSFUL! Received idToken length:", body.idToken.length);

  // Test calling /v1/monitors with the new idToken
  const monitorsRes = await fetch("https://api.uptimemonke.com/v1/monitors", {
    headers: {
      authorization: `Bearer ${body.idToken}`,
    },
  });

  const monitors = await monitorsRes.json();
  console.log("API /v1/monitors verification response:", monitorsRes.status, Array.isArray(monitors) ? `Returned ${monitors.length} monitors` : monitors);
}

main().catch((err) => {
  console.error("Error executing script:", err);
  process.exit(1);
});
