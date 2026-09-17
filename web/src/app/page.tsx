import type { Metadata } from "next";
import Landing from "@/components/Landing";
import { getMetadataForLocale, generateLocalizedStructuredData } from "@/lib/i18n/seo";

/**
 * The public, indexable root page with multi-locale alternates and automatic client detection.
 */
export const metadata: Metadata = getMetadataForLocale("en", "");

export default function Home() {
  const structuredData = generateLocalizedStructuredData("en");

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <Landing />
    </>
  );
}
