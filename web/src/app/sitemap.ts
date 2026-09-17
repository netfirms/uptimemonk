import type { MetadataRoute } from "next";

/**
 * `output: export` requires route handlers to declare themselves static, or
 * the build refuses to emit them.
 */
export const dynamic = "force-static";

const SITE = "https://www.uptimemonke.com";

/**
 * Multi-locale sitemap with Google xhtml:link hreflang alternate links.
 *
 * Status pages are deliberately absent: their slugs are customer data, they
 * are not enumerable at build time from a static export, and publishing a list
 * of who uses the product is not ours to do.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const alternateLanguages = {
    en: `${SITE}/`,
    ja: `${SITE}/ja`,
    ko: `${SITE}/ko`,
    ms: `${SITE}/ms`,
    id: `${SITE}/id`,
    my: `${SITE}/my`,
    "x-default": `${SITE}/`,
  };

  const pages = [
    { path: "", priority: 1.0, changeFrequency: "daily" as const },
    { path: "/en", priority: 0.9, changeFrequency: "weekly" as const },
    { path: "/ja", priority: 0.9, changeFrequency: "weekly" as const },
    { path: "/ko", priority: 0.9, changeFrequency: "weekly" as const },
    { path: "/ms", priority: 0.9, changeFrequency: "weekly" as const },
    { path: "/id", priority: 0.9, changeFrequency: "weekly" as const },
    { path: "/my", priority: 0.9, changeFrequency: "weekly" as const },
  ];

  return pages.map((p) => ({
    url: `${SITE}${p.path}`,
    lastModified: now,
    changeFrequency: p.changeFrequency,
    priority: p.priority,
    alternates: {
      languages: alternateLanguages,
    },
  }));
}
