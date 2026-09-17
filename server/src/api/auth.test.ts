import { describe, test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import Fastify, { type FastifyInstance } from "fastify";
import { requireAuth, requireOwner } from "./auth.js";
import { setCustomAuth } from "../sync/firebase.js";
import type { Auth } from "firebase-admin/auth";

describe("API Auth Middleware", () => {
  let app: FastifyInstance;

  before(async () => {
    app = Fastify({ logger: false });
    app.get("/test", { preHandler: [requireAuth()] }, async (req) => ({ ok: true, user: req.user }));
    app.get("/owner-only", { preHandler: [requireAuth(), requireOwner] }, async () => ({ ok: true }));
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  beforeEach(() => {
    setCustomAuth(null);
  });

  test("rejects request without authorization header", async () => {
    const res = await app.inject({ method: "GET", url: "/test" });
    assert.equal(res.statusCode, 401);
    assert.match(res.json().error, /Sign in to continue/i);
  });

  test("rejects request with malformed Bearer token", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/test",
      headers: { authorization: "Basic 123" },
    });
    assert.equal(res.statusCode, 401);
  });

  test("rejects token without orgId with 409 needs-bootstrap", async () => {
    setCustomAuth({
      verifyIdToken: async () =>
        ({ uid: "u1", email: "user@test.com", email_verified: true } as any),
    } as unknown as Auth);

    const res = await app.inject({
      method: "GET",
      url: "/test",
      headers: { authorization: "Bearer valid-token" },
    });
    assert.equal(res.statusCode, 409);
    assert.equal(res.json().code, "needs-bootstrap");
  });

  test("refuses a token whose email is not verified", async () => {
    // A password sign-up until the link is clicked. The dashboard also gates
    // this, but a gate in the browser is a suggestion — the API only ever
    // sees the token.
    setCustomAuth({
      verifyIdToken: async () =>
        ({
          uid: "u1",
          orgId: "org-1",
          role: "owner",
          email: "unconfirmed@test.com",
          email_verified: false,
        } as any),
    } as unknown as Auth);

    const res = await app.inject({
      method: "GET",
      url: "/test",
      headers: { authorization: "Bearer valid-token" },
    });
    assert.equal(res.statusCode, 403);
    assert.equal(res.json().code, "email-not-verified");
  });

  test("a missing email_verified flag is not permission", async () => {
    // Absent must never read as yes on a security check.
    setCustomAuth({
      verifyIdToken: async () =>
        ({ uid: "u1", orgId: "org-1", role: "owner", email: "a@test.com" } as any),
    } as unknown as Auth);

    const res = await app.inject({
      method: "GET",
      url: "/test",
      headers: { authorization: "Bearer valid-token" },
    });
    assert.equal(res.statusCode, 403);
  });

  test("a token with no email at all is let through", async () => {
    // No enabled provider makes one today; the exemption is so that turning
    // on phone or anonymous auth later locks nobody out by surprise.
    setCustomAuth({
      verifyIdToken: async () =>
        ({ uid: "u1", orgId: "org-1", role: "owner" } as any),
    } as unknown as Auth);

    const res = await app.inject({
      method: "GET",
      url: "/test",
      headers: { authorization: "Bearer valid-token" },
    });
    assert.equal(res.statusCode, 200);
  });

  test("authenticates valid token with orgId and role", async () => {
    setCustomAuth({
      verifyIdToken: async () =>
        ({
          uid: "u1",
          orgId: "org-1",
          role: "owner",
          email: "owner@test.com",
          email_verified: true,
        } as any),
    } as unknown as Auth);

    const res = await app.inject({
      method: "GET",
      url: "/test",
      headers: { authorization: "Bearer valid-token" },
    });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json().user, {
      uid: "u1",
      orgId: "org-1",
      role: "owner",
      email: "owner@test.com",
    });
  });

  test("rejects invalid or expired token with 401", async () => {
    setCustomAuth({
      verifyIdToken: async () => {
        throw new Error("Token expired");
      },
    } as unknown as Auth);

    const res = await app.inject({
      method: "GET",
      url: "/test",
      headers: { authorization: "Bearer expired-token" },
    });
    assert.equal(res.statusCode, 401);
    assert.match(res.json().error, /session has expired/i);
  });

  test("requireOwner allows workspace owner", async () => {
    setCustomAuth({
      verifyIdToken: async () => ({ uid: "u1", orgId: "org-1", role: "owner" } as any),
    } as unknown as Auth);

    const res = await app.inject({
      method: "GET",
      url: "/owner-only",
      headers: { authorization: "Bearer valid-token" },
    });
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().ok, true);
  });

  test("requireOwner forbids non-owner member with 403", async () => {
    setCustomAuth({
      verifyIdToken: async () => ({ uid: "u1", orgId: "org-1", role: "member" } as any),
    } as unknown as Auth);

    const res = await app.inject({
      method: "GET",
      url: "/owner-only",
      headers: { authorization: "Bearer valid-token" },
    });
    assert.equal(res.statusCode, 403);
    assert.match(res.json().error, /Only the workspace owner/i);
  });
});
