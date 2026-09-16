"use client";

import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyDBco29lK8EeJ6eD7Rf0JSX2Mqb4yKlRjc",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "uptimemonk.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "uptimemonk",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:174268178454:web:0d01303aca364fe16ed537",
};

export const app: FirebaseApp = getApps().length ? getApp() : initializeApp(config);
export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);
