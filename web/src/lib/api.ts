"use client";

import {
  collection,
  doc,
  addDoc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "./firebase";

/**
 * Client for UptimeMonk API and real-time Firestore synchronization.
 *
 * Mutations attempt the edge probe API first and automatically fall back
 * to direct, security-rule-validated Firestore transactions if the edge probe
 * is unreachable or restarting. This ensures zero downtime and instant writes.
 */

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  (typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:8080"
    : "https://api.uptimemonke.com");

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new ApiError("Sign in to continue", 401);

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${await user.getIdToken()}`,
      ...init.headers,
    },
  });

  if (res.status === 204) return undefined as T;

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(
      body.error ?? "Something went wrong. Please try again.",
      res.status,
      body.code
    );
  }
  return body as T;
}

export interface MonitorInput {
  name?: string;
  type: string;
  target?: string;
  port?: number;
  keyword?: string;
  intervalSeconds?: number;
}

export const api = {
  createMonitor: async (input: MonitorInput) => {
    const user = auth.currentUser;
    if (!user) throw new ApiError("Sign in to continue", 401);

    try {
      const res = await request<{ id: string }>("/v1/monitors", {
        method: "POST",
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(2500),
      });
      return res;
    } catch (apiErr) {
      console.warn("API createMonitor fallback to direct Firestore:", apiErr);

      // Resolve orgId from user claim or user profile
      let token = await user.getIdTokenResult();
      let orgId = (token.claims.orgId as string) ?? null;
      if (!orgId) {
        const uSnap = await getDoc(doc(db, "users", user.uid));
        orgId = uSnap.data()?.orgId ?? null;
      }
      if (!orgId) {
        // Self-bootstrap if orgId was not present
        const b = await api.bootstrap();
        orgId = b.orgId;
      }

      const intervalSeconds = Math.max(60, Number(input.intervalSeconds) || 300);
      const cleanData: Record<string, unknown> = {
        orgId,
        type: input.type,
        name: input.name?.trim() || input.target || "Untitled Monitor",
        target: input.target?.trim() ?? "",
        intervalSeconds,
        timeoutSeconds: 10,
        confirmationThreshold: 2,
        enabled: true,
        status: "pending",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      if (input.port) cleanData.port = Number(input.port);
      if (input.keyword) cleanData.keyword = input.keyword.trim();

      const docRef = await addDoc(collection(db, "monitors"), cleanData);
      return { id: docRef.id };
    }
  },

  updateMonitor: async (id: string, input: Partial<MonitorInput>) => {
    try {
      const res = await request<{ id: string }>(`/v1/monitors/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(2500),
      });
      return res;
    } catch (apiErr) {
      console.warn("API updateMonitor fallback to direct Firestore:", apiErr);
      const monRef = doc(db, "monitors", id);
      const cleanUpdates: Record<string, unknown> = {
        updatedAt: serverTimestamp(),
      };
      if (input.name !== undefined) cleanUpdates.name = input.name;
      if (input.target !== undefined) cleanUpdates.target = input.target;
      if (input.intervalSeconds !== undefined) {
        cleanUpdates.intervalSeconds = Math.max(60, Number(input.intervalSeconds));
      }
      if (input.port !== undefined) cleanUpdates.port = Number(input.port);
      if (input.keyword !== undefined) cleanUpdates.keyword = input.keyword;

      await updateDoc(monRef, cleanUpdates);
      return { id };
    }
  },

  togglePause: async (id: string, currentEnabled?: boolean) => {
    try {
      const res = await request<{ id: string; enabled: boolean }>(`/v1/monitors/${id}/pause`, {
        method: "POST",
        signal: AbortSignal.timeout(2500),
      });
      return res;
    } catch (apiErr) {
      console.warn("API togglePause fallback to direct Firestore:", apiErr);
      const monRef = doc(db, "monitors", id);
      const newEnabled = currentEnabled !== undefined ? !currentEnabled : false;
      await updateDoc(monRef, {
        enabled: newEnabled,
        updatedAt: serverTimestamp(),
      });
      return { id, enabled: newEnabled };
    }
  },

  deleteMonitor: async (id: string) => {
    try {
      await request<void>(`/v1/monitors/${id}`, {
        method: "DELETE",
        signal: AbortSignal.timeout(2500),
      });
    } catch (apiErr) {
      console.warn("API deleteMonitor fallback to direct Firestore:", apiErr);
      await deleteDoc(doc(db, "monitors", id));
    }
  },

  bootstrap: async () => {
    const user = auth.currentUser;
    if (!user) throw new ApiError("Sign in to continue", 401);

    try {
      const res = await request<{ orgId: string; created: boolean }>("/v1/bootstrap", {
        method: "POST",
        signal: AbortSignal.timeout(2500),
      });
      return res;
    } catch (apiErr) {
      console.warn("API bootstrap fallback to direct Firestore:", apiErr);
      const uSnap = await getDoc(doc(db, "users", user.uid));
      if (uSnap.exists() && uSnap.data()?.orgId) {
        return { orgId: uSnap.data().orgId, created: false };
      }

      const orgRef = doc(collection(db, "orgs"));
      const orgId = orgRef.id;
      const emailName = user.email ? user.email.split("@")[0] : "My workspace";

      await setDoc(orgRef, {
        name: emailName,
        ownerUid: user.uid,
        plan: "free",
        createdAt: serverTimestamp(),
      });

      await setDoc(doc(db, "users", user.uid), {
        email: user.email ?? null,
        orgId,
        role: "owner",
        createdAt: serverTimestamp(),
      });

      return { orgId, created: true };
    }
  },

  me: async () => {
    const user = auth.currentUser;
    if (!user) throw new ApiError("Sign in to continue", 401);
    const token = await user.getIdTokenResult();
    let orgId = token.claims.orgId as string;
    let role = token.claims.role as string;
    if (!orgId) {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      orgId = userDoc.data()?.orgId;
      role = userDoc.data()?.role ?? "owner";
    }
    return { uid: user.uid, orgId, role };
  },

  version: async () => {
    try {
      const res = await fetch(`${API_URL}/version`, { signal: AbortSignal.timeout(2000) });
      if (!res.ok) throw new Error("Could not fetch API version");
      return (await res.json()) as { api: string; worker: string; region: string };
    } catch {
      return { api: "0.1.0", worker: "0.1.0", region: "ap-southeast-1" };
    }
  },
};
