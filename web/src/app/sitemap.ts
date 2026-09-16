import type { MetadataRoute } from "next";

/**
 * `output: export` requires route handlers to declare themselves static, or
 * the build refuses to emit them.
 */
export const dynamic = "force-static";


const SITE = "https://www.uptimemonke.com";

/**
 * Only the pages that are genuinely public and stable.
 *
 * Status pages are deliberately absent: their slugs are customer data, they
 * are not enumerable at build time from a static export, and publishing a list
 * of who uses the product is not ours to do. Customers link to their own
 * status page directly, which is how those get discovered.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    {
      url: SITE,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
