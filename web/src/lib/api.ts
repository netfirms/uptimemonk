"use client";

import { auth } from "./firebase";

/**
 * Client for the probe box's API.
 *
 * Every mutation goes here rather than to Firestore: plan limits need a count
 * and a safe target needs a DNS resolution, and security rules can do neither.
 * Reads stay on Firestore, where the realtime listener is free.
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
      // The box verifies this against Google's public keys and reads orgId
      // from the verified claims — never from anything we send in the body.
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
  createMonitor: (input: MonitorInput) =>
    request<{ id: string }>("/v1/monitors", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  updateMonitor: (id: string, input: Partial<MonitorInput>) =>
    request<{ id: string }>(`/v1/monitors/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),

  togglePause: (id: string) =>
    request<{ id: string; enabled: boolean }>(`/v1/monitors/${id}/pause`, {
      method: "POST",
    }),

  deleteMonitor: (id: string) =>
    request<void>(`/v1/monitors/${id}`, { method: "DELETE" }),

  /**
   * Creates the workspace for a brand-new account.
   *
   * On the free tier there is no `beforeUserCreated` blocking function, so the
   * client asks for this once after signup. It is idempotent by design: a retry
   * after a dropped response is the normal case, not the exception.
   */
  bootstrap: () =>
    request<{ orgId: string; created: boolean }>("/v1/bootstrap", { method: "POST" }),

  me: () => request<{ uid: string; orgId: string; role: string }>("/v1/me"),

  version: async () => {
    const res = await fetch(`${API_URL}/version`);
    if (!res.ok) throw new Error("Could not fetch API version");
    return res.json() as Promise<{ api: string; worker: string; region: string }>;
  },
};
