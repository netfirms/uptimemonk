import type { FastifyInstance } from "fastify";
import { col } from "../sync/firebase.js";
import { listMonitors } from "../db/repo.js";
import { parseRange, type RangeKey } from "../lib/ranges.js";
import { seriesFor } from "../monitors/series.js";
import { RANGES } from "../lib/ranges.js";
import { log } from "../lib/log.js";

/**
 * The public status page feed.
 *
 * Unauthenticated by design — that is the whole point of a status page — which
 * makes it the one endpoint where the shape of the response is a security
 * decision rather than a convenience. Three rules hold it together:
 *
 *  1. **Opt-in per monitor.** Only monitors with `publicOnStatusPage === true`
 *     appear. A page never leaks the existence of the ones the customer did
 *     not tick.
 *  2. **Name and health only.** The target URL, the keyword being matched, the
 *     alert contacts and the last error are all withheld. "api.example.com is
 *     down" is the customer's message to publish; "we probe
 *     https://internal.example.com/_health?token=…" is not.
 *  3. **No enumeration.** An unknown slug and an existing-but-empty page both
 *     answer 404 with the same body, so the endpoint cannot be walked to
 *     discover which orgs exist.
 */

/** Serve from memory for a spell: an outage is exactly when a status page
 *  gets linked everywhere at once, and SQLite is shared with the worker. */
const CACHE_TTL_MS = 20_000;
/** Keyed by slug *and* range: four windows of the same page are four
 *  different responses, and one would otherwise be served for another. */
const cache = new Map<string, { at: number; body: PublicStatus | null }>();

interface PublicMonitor {
  id: string;
  name: string;
  status: string;
  uptime30d?: number;
  lastCheckedAt?: number;
  /** Oldest first, so the bars render left-to-right without reversing. */
  buckets: { t: number; up: number; down: number; avgMs: number; uptimeRatio: number }[];
}

interface PublicStatus {
  title: string;
  description?: string;
  updatedAt: number;
  range: RangeKey;
  granularity: "hour" | "day";
  monitors: PublicMonitor[];
}

/**
 * Turn what the two lookups found into a page, or nothing.
 *
 * Split out from the I/O because the interesting rule is here rather than in
 * the queries: the org-id fallback deliberately returns no title. Bootstrap
 * names an org after the local-part of the owner's email address, and using
 * that as the heading of a page anyone can open would publish the address
 * itself. A page is only titled once someone has set a title explicitly.
 */
export function resolvePage(
  custom: Record<string, unknown> | null,
  orgExists: boolean,
  slug: string
): { orgId: string; title?: string; description?: string } | null {
  if (custom) {
    if (typeof custom.orgId !== "string" || !custom.orgId) return null;
    return {
      orgId: custom.orgId,
      title: typeof custom.title === "string" ? custom.title : undefined,
      description: typeof custom.description === "string" ? custom.description : undefined,
    };
  }
  return orgExists ? { orgId: slug } : null;
}

/**
 * Shape check before either lookup, so a junk slug costs no Firestore read.
 *
 * Wide enough to cover both things that reach here: a customer-chosen slug
 * (3-40, lowercase and hyphens — see `lib/slug.ts`) and a raw workspace id,
 * which is the fallback address. The minimum was 6 and silently made every
 * three-character slug unresolvable.
 */
export const isPlausibleSlug = (s: string) => /^[A-Za-z0-9_-]{3,64}$/.test(s);

/**
 * Resolve a slug to the org it publishes.
 *
 * A custom slug in `statusPages` wins. Failing that the slug is treated as an
 * org id, which is what gives every org a working page the moment it ticks a
 * monitor — without a management UI, and without us minting a pretty slug that
 * might collide with someone else's.
 */
async function resolveOrg(
  slug: string
): Promise<{ orgId: string; title?: string; description?: string } | null> {
  if (!isPlausibleSlug(slug)) return null;

  const page = await col
    .statusPages()
    .where("slug", "==", slug)
    .where("published", "==", true)
    .limit(1)
    .get();

  if (!page.empty) return resolvePage(page.docs[0].data(), false, slug);

  const org = await col.orgs().doc(slug).get();
  return resolvePage(null, org.exists, slug);
}

/** Exported for tests: this projection is the security boundary. */
export function buildPublicStatus(
  orgId: string,
  title: string,
  description?: string,
  range: RangeKey = "90d"
): PublicStatus | null {
  const monitors = listMonitors(orgId).filter((m) => m.publicOnStatusPage === true);
  if (monitors.length === 0) return null;

  return {
    title,
    description,
    updatedAt: Date.now(),
    range,
    granularity: RANGES[range].granularity,
    monitors: monitors.map((m) => ({
      id: m.id,
      name: m.name,
      // A paused monitor is nobody's business but the owner's; showing it as
      // "paused" on a public page reads as an admission of a gap.
      status: m.enabled ? m.status : "paused",
      uptime30d: m.uptime30d,
      lastCheckedAt: m.lastCheckedAt,
      buckets: seriesFor(m.id, range).buckets,
    })),
  };
}

export async function statusRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { slug: string }; Querystring: { range?: string } }>(
    "/v1/status/:slug",
    async (req, reply) => {
    const slug = String(req.params.slug ?? "").trim();
    const range = parseRange(req.query.range);
    const cacheKey = `${slug}:${range}`;

    const hit = cache.get(cacheKey);
    const fresh = hit && Date.now() - hit.at < CACHE_TTL_MS;
    let body = fresh ? hit.body : undefined;

    if (body === undefined) {
      try {
        const page = await resolveOrg(slug);
        body = page
          ? buildPublicStatus(
              page.orgId,
              page.title || "Service status",
              page.description,
              range
            )
          : null;
      } catch (err) {
        log.warn({ err, slug }, "status page lookup failed");
        // Serve a stale copy rather than a 500: during an outage the status
        // page is the last thing that should go down with everything else.
        if (hit) return reply.header("x-cache", "stale").send(hit.body ?? undefined);
        return reply.code(503).send({ error: "Status is temporarily unavailable" });
      }
      cache.set(cacheKey, { at: Date.now(), body });
      // Bounded so a flood of junk slugs cannot grow it without limit.
      if (cache.size > 500) cache.delete(cache.keys().next().value!);
    }

    if (!body) {
      // Same answer for "no such page" and "page with nothing published".
      return reply.code(404).send({ error: "No status page here" });
    }

    // A minute at the CDN: visitors during an incident all share one render,
    // and `stale-while-revalidate` keeps it serving while it refreshes.
    reply.header("cache-control", "public, max-age=60, stale-while-revalidate=120");
    return body;
    }
  );
}
