"use client";

import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getAnalytics, isSupported, type Analytics } from "firebase/analytics";

/**
 * Firebase client configuration.
 *
 * These values are public by design — they identify the project, they do not
 * grant access to it. Security comes from Firestore rules and Auth, which is
 * why the rules deny client writes to `monitors` outright and every mutation
 * goes through the worker API. Shipping them in the bundle is expected.
 *
 * Environment variables still take precedence so a staging build can point at
 * a different project without a code change.
 */
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyDBco29lK8EeJ6eD7Rf0JSX2Mqb4yKlRjc",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "uptimemonk.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "uptimemonk",
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "uptimemonk.firebasestorage.app",
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "174268178454",
  appId:
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID ||
    "1:174268178454:web:09f7c4ff1b9e6df76ed537",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-RXQ64KZJBK",
};

export const app: FirebaseApp = getApps().length ? getApp() : initializeApp(config);
export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);

/**
 * Analytics, initialised lazily and only in a browser.
 *
 * `getAnalytics()` reads `window` and throws if called during the build — and
 * this site is a static export, so every module is evaluated in Node at build
 * time. Calling it at module scope would fail the build outright.
 *
 * `isSupported()` is the second guard: it returns false where measurement
 * cannot work (no cookies, some in-app and privacy browsers), and calling
 * `getAnalytics` there throws rather than degrading.
 *
 * Analytics is never required for the app to function — a failure here must
 * never take the dashboard down with it.
 */
let analyticsInstance: Analytics | null = null;

export async function initAnalytics(): Promise<Analytics | null> {
  if (typeof window === "undefined") return null;
  if (analyticsInstance) return analyticsInstance;
  if (!config.measurementId) return null;

  try {
    if (!(await isSupported())) return null;
    analyticsInstance = getAnalytics(app);
    return analyticsInstance;
  } catch {
    // Measurement is not worth a broken page.
    return null;
  }
}

/** The instance if it has already been created, otherwise null. */
export const analytics = () => analyticsInstance;
