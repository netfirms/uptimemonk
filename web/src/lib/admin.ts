import "server-only";
import { initializeApp, getApps, cert, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

/**
 * Server-side Firestore for public status pages.
 *
 * Status pages are rendered with the Admin SDK rather than the client SDK on
 * purpose: the page must be readable by anonymous visitors and indexable by
 * search engines, and doing it server-side means one cached render serves
 * everyone instead of every visitor paying for their own Firestore reads.
 */
const projectId =
  process.env.GOOGLE_CLOUD_PROJECT ||
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
  "uptimemonk";

if (!getApps().length) {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT;
  try {
    initializeApp({
      projectId,
      credential: json ? cert(JSON.parse(json)) : applicationDefault(),
    });
  } catch {
    initializeApp({ projectId });
  }
}

export const adminDb = getFirestore();
