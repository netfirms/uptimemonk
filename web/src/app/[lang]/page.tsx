import type { Metadata } from "next";
import Landing from "@/components/Landing";
import { isSupportedLocale, type SupportedLocale, SUPPORTED_LOCALES } from "@/lib/i18n/locales";
import { getMetadataForLocale, generateLocalizedStructuredData } from "@/lib/i18n/seo";
import { I18nProvider } from "@/lib/i18n/context";

export const dynamic = "force-static";

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((l) => ({ lang: l.code }));
}

interface PageProps {
  params: Promise<{ lang: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang } = await params;
  const locale: SupportedLocale = isSupportedLocale(lang) ? lang : "en";
  return getMetadataForLocale(locale, `/${lang}`);
}

export default async function LocalizedPage({ params }: PageProps) {
  const { lang } = await params;
  const locale: SupportedLocale = isSupportedLocale(lang) ? lang : "en";
  const structuredData = generateLocalizedStructuredData(locale);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <I18nProvider initialLocale={locale}>
        <Landing />
      </I18nProvider>
    </>
  );
}
