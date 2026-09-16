import type { MetadataRoute } from "next";

/**
 * `output: export` requires route handlers to declare themselves static, or
 * the build refuses to emit them.
 */
export const dynamic = "force-static";


const SITE = "https://uptimemonke.com";

/**
 * Generated to a static robots.txt at build time.
 *
 * The important half is what is DISALLOWED. /dashboard is the signed-in
 * application: it renders nothing useful to a crawler, and letting it into an
 * index invites people to land on an empty app shell from search. Status pages
 * are the opposite — they exist to be linked to publicly.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/dashboard",
          "/dashboard/",
          "/api/",
          // Query strings on the app add nothing and split crawl budget.
          "/*?",
        ],
      },
    ],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
