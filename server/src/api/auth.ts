import type { FastifyReply, FastifyRequest } from "fastify";
import { auth } from "../sync/firebase.js";
import { log } from "../lib/log.js";

/**
 * Request authentication.
 *
 * The browser holds a Firebase ID token; the worker verifies it against Google's
 * public keys. That verification is local after the first key fetch, costs
 * nothing, and counts against no quota — which is what lets Firebase Auth stay
 * in the design while everything else moves to the workers.
 *
 * `orgId` and `role` are read from the *verified claims*, never from the
 * request body. That distinction is the entire tenancy boundary.
 */

declare module "fastify" {
  interface FastifyRequest {
    user?: { uid: string; orgId: string; role: string; email?: string };
  }
}

export interface AuthOptions {
  /** Re-check that the session has not been revoked. Costs a network call, so
   *  reserve it for billing and member management. */
  checkRevoked?: boolean;
}

export function requireAuth(options: AuthOptions = {}) {
  return async function (req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const header = req.headers.authorization ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) {
      return reply.code(401).send({ error: "Sign in to continue" });
    }

    try {
      const decoded = await auth().verifyIdToken(token, options.checkRevoked === true);
      const orgId = decoded.orgId as string | undefined;
      if (!orgId) {
        // A user exists but has no workspace yet. On the free tier there is no
        // blocking function to create one at signup, so the client is expected
        // to call POST /v1/bootstrap first.
        return reply.code(409).send({
          error: "No workspace yet",
          code: "needs-bootstrap",
        });
      }
      req.user = {
        uid: decoded.uid,
        orgId,
        role: (decoded.role as string) ?? "member",
        email: decoded.email,
      };
    } catch (err) {
      log.debug({ err }, "token verification failed");
      return reply.code(401).send({ error: "Your session has expired. Sign in again." });
    }
  };
}

export function requireOwner(req: FastifyRequest, reply: FastifyReply): void {
  if (req.user?.role !== "owner") {
    void reply.code(403).send({ error: "Only the workspace owner can do that" });
  }
}
