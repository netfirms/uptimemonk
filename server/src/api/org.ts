import type { FastifyInstance } from "fastify";
import { Timestamp } from "firebase-admin/firestore";
import { col, db } from "../sync/firebase.js";
import { requireAuth, requireOwner } from "./auth.js";
import { log } from "../lib/log.js";
import {
  InvalidSlugError,
  normaliseOrgName,
  normaliseSlug,
  suggestSlug,
} from "../lib/slug.js";
import { APP_URL } from "../config.js";

/**
 * Workspace name, and the public status page's address.
 *
 * These are different kinds of thing despite sitting on one screen. A name is
 * a label the customer sees; a slug is a public URL that must be unique
 * across every workspace, cannot collide with a route, and once shared cannot
 * quietly change under whoever bookmarked it.
 */
export async function orgRoutes(app: FastifyInstance): Promise<void> {
  app.get("/v1/org", { preHandler: requireAuth() }, async (req) => {
    const { orgId } = req.user!;
    const [org, pages] = await Promise.all([
      col.orgs().doc(orgId).get(),
      col.statusPages().where("orgId", "==", orgId).limit(1).get(),
    ]);

    const name = (org.data()?.name as string) ?? "";
    const page = pages.empty ? null : pages.docs[0].data();

    return {
      orgId,
      name,
      statusPage: {
        slug: (page?.slug as string) ?? null,
        title: (page?.title as string) ?? null,
        description: (page?.description as string) ?? null,
        published: page?.published !== false,
        /** What the URL is today — the org id until a slug is claimed. */
        url: `${APP_URL.replace(/\/$/, "")}/status/${(page?.slug as string) ?? orgId}`,
        suggestion: suggestSlug(name),
      },
    };
  });

  /** Renaming the workspace. Owner-only: it is what everyone else sees. */
  app.patch<{ Body: { name?: string } }>(
    "/v1/org",
    { preHandler: [requireAuth(), requireOwner] },
    async (req, reply) => {
      let name: string;
      try {
        name = normaliseOrgName(req.body?.name);
      } catch (err) {
        if (err instanceof InvalidSlugError) {
          return reply.code(400).send({ error: err.message });
        }
        throw err;
      }

      await col.orgs().doc(req.user!.orgId).update({ name });
      log.info({ orgId: req.user!.orgId }, "workspace renamed");
      return { name };
    }
  );

  /**
   * Claim or change the public status page address.
   *
   * The whole thing runs in one transaction against `statusSlugs/{slug}`,
   * whose document id *is* the slug. Firestore has no unique index, so
   * checking "is it taken?" and then writing would be a race two customers
   * could both win. Creating the document is the check.
   */
  app.put<{ Body: { slug?: string; title?: string; description?: string; published?: boolean } }>(
    "/v1/org/status-page",
    { preHandler: [requireAuth(), requireOwner] },
    async (req, reply) => {
      const { orgId } = req.user!;

      let slug: string;
      try {
        slug = normaliseSlug(req.body?.slug);
      } catch (err) {
        if (err instanceof InvalidSlugError) {
          return reply.code(400).send({ error: err.message });
        }
        throw err;
      }

      const title = String(req.body?.title ?? "").trim().slice(0, 60);
      const description = String(req.body?.description ?? "").trim().slice(0, 200);
      const published = req.body?.published !== false;

      const claim = col.statusSlugs().doc(slug);
      const existingPages = await col.statusPages().where("orgId", "==", orgId).limit(1).get();
      const pageRef = existingPages.empty ? col.statusPages().doc() : existingPages.docs[0].ref;
      const previousSlug = existingPages.empty
        ? null
        : ((existingPages.docs[0].data().slug as string) ?? null);

      try {
        await db().runTransaction(async (tx) => {
          const held = await tx.get(claim);
          if (held.exists && held.data()?.orgId !== orgId) {
            throw new InvalidSlugError("That address is already taken");
          }

          tx.set(claim, { orgId, at: Timestamp.now() });
          tx.set(
            pageRef,
            {
              orgId,
              slug,
              title: title || null,
              description: description || null,
              published,
              updatedAt: Timestamp.now(),
            },
            { merge: true }
          );

          // Let the old address go, or a workspace slowly hoards names it no
          // longer uses and nobody else can ever claim them.
          if (previousSlug && previousSlug !== slug) {
            tx.delete(col.statusSlugs().doc(previousSlug));
          }
        });
      } catch (err) {
        if (err instanceof InvalidSlugError) {
          return reply.code(409).send({ error: err.message });
        }
        throw err;
      }

      log.info({ orgId, slug, previousSlug }, "status page address set");
      return {
        slug,
        title: title || null,
        description: description || null,
        published,
        url: `${APP_URL.replace(/\/$/, "")}/status/${slug}`,
        /** The old address stops working immediately — worth saying so. */
        replaced: previousSlug && previousSlug !== slug ? previousSlug : null,
      };
    }
  );
}
