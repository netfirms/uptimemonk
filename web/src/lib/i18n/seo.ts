import type { Metadata } from "next";
import { type SupportedLocale, SUPPORTED_LOCALES } from "./locales";
import { TRANSLATIONS } from "./translations";

export interface LocaleSeoData {
  title: string;
  description: string;
  keywords: string[];
  ogLocale: string;
  applicationDescription: string;
  offersDescription: string;
  featureList: string[];
}

export const BASE_URL = "https://www.uptimemonke.com";

export const LOCALE_SEO: Record<SupportedLocale, LocaleSeoData> = {
  en: {
    title: "UptimeMonke — High-Frequency Infrastructure Monitoring",
    description:
      "High-frequency website and API uptime monitoring with sub-minute checks, SSL certificate expiry tracking, cron heartbeat pings, instant multi-channel alerts, and elegant public status pages. 100% free forever.",
    keywords: [
      "uptime monitoring",
      "website monitoring",
      "api uptime monitor",
      "synthetic monitoring",
      "ssl certificate monitoring",
      "cron job heartbeat",
      "public status page",
      "ping monitoring",
      "port monitoring",
      "slack uptime alerts",
      "discord downtime alerts",
      "incident management",
      "free uptime robot alternative",
      "devops monitoring tools",
    ],
    ogLocale: "en_US",
    applicationDescription:
      "High-frequency website & API monitoring with sub-minute checks, SSL certificate tracking, cron heartbeat pings, and elegant public status pages.",
    offersDescription: "Free tier with 14,400 checks every single day forever",
    featureList: [
      "HTTP and keyword uptime monitoring",
      "TCP port monitoring",
      "DNS record verification",
      "SSL certificate expiry alerts",
      "ICMP ping latency checks",
      "Cron heartbeat monitoring",
      "Multi-channel alerts (Slack, Discord, Email, Webhooks)",
      "Elegant public status pages with 90-day history bars",
    ],
  },
  ja: {
    title: "UptimeMonke — 高頻度インフラ・Webサイト死活監視サービス",
    description:
      "1分未満のサブミニッツチェック、SSL証明書有効期限監視、Cronハートビート監視、Slack/Discord即時障害アラート、公開ステータスページを備えた高頻度Webサイト・API監視。ずっと無料。",
    keywords: [
      "Webサイト監視",
      "死活監視",
      "API監視",
      "SSL証明書監視",
      "クロン監視",
      "ハートビート監視",
      "ステータスページ",
      "サーバー監視",
      "Slack通知",
      "Discord通知",
      "UptimeRobot 代替",
      "無料 死活監視",
      "インフラ監視",
    ],
    ogLocale: "ja_JP",
    applicationDescription:
      "1分未満の高速チェック、SSL証明書期限監視、Cronハートビート、Slack・Discord即時通知、公開ステータスページを備えた高頻度インフラ死活監視サービス。",
    offersDescription: "毎日14,400回のチェックが完全無料（永久無料枠）",
    featureList: [
      "HTTPおよびキーワード死活監視",
      "TCPポート監視",
      "DNSレコード検証",
      "SSL証明書有効期限アラート",
      "ICMP Pingレイテンシ監視",
      "Cronジョブ・ハートビート監視",
      "マルチチャネルアラート（Slack、Discord、メール、Webhook）",
      "90日間の履歴バー付き公開ステータスページ",
    ],
  },
  ko: {
    title: "UptimeMonke — 초고주기 인프라 및 웹사이트 모니터링",
    description:
      "1분 미만 고주기 체크, SSL 인증서 만료 추적, Cron 하트비트 핑, Slack 및 Discord 실시간 장애 알림, 공개 상태 페이지를 제공하는 무료 웹사이트 및 API 모니터링 플랫폼.",
    keywords: [
      "웹사이트 모니터링",
      "서버 모니터링",
      "API 모니터링",
      "SSL 인증서 만료",
      "크론 모니터링",
      "하트비트 모니터링",
      "상태 페이지",
      "슬랙 장애 알림",
      "디스코드 알림",
      "업타임로봇 대체",
      "무료 모니터링",
      "인프라 모니터링",
    ],
    ogLocale: "ko_KR",
    applicationDescription:
      "1분 미만 주기 체크, SSL 인증서 만료 모니터링, 크론 하트비트 핑, 실시간 멀티채널 장애 알림 및 아름다운 공개 상태 페이지를 지원하는 모니터링 플랫폼.",
    offersDescription: "매일 14,400회 체크 영구 무료 제공",
    featureList: [
      "HTTP 및 키워드 가동시간 모니터링",
      "TCP 포트 모니터링",
      "DNS 레코드 확인",
      "SSL 인증서 만료 사전 경고",
      "ICMP Ping 지연시간 모니터링",
      "Cron 및 백그라운드 워커 하트비트 모니터링",
      "멀티채널 실시간 알림 (Slack, Discord, 이메일, Webhook)",
      "90일 가동률 막대가 포함된 공개 상태 페이지",
    ],
  },
  ms: {
    title: "UptimeMonke — Pemantauan Infrastruktur & Laman Web Berfrekuensi Tinggi",
    description:
      "Pemantauan masa henti laman web dan API berfrekuensi tinggi dengan semakan bawah seminit, amaran luput sijil SSL, ping degupan jantung cron, makluman segera Slack & Discord, serta halaman status awam. Percuma selamanya.",
    keywords: [
      "pemantauan laman web",
      "pemantauan masa aktif",
      "semakan SSL",
      "pemantauan cron",
      "halaman status awam",
      "makluman gangguan",
      "pemantauan pelayan",
      "pemantauan API",
      "alternatif uptimerobot",
      "percuma selamanya",
    ],
    ogLocale: "ms_MY",
    applicationDescription:
      "Pemantauan masa aktif laman web dan API berfrekuensi tinggi dengan semakan sub-minit, amaran luput SSL, ping degupan jantung cron, dan halaman status awam.",
    offersDescription: "Pelan percuma dengan 14,400 semakan setiap hari selamanya",
    featureList: [
      "Pemantauan masa aktif HTTP dan kata kunci",
      "Pemantauan port TCP",
      "Pengesahan rekod DNS",
      "Amaran tamat tempoh sijil SSL",
      "Semakan kependaman ping ICMP",
      "Pemantauan degupan jantung Cron",
      "Makluman pelbagai saluran (Slack, Discord, E-mel, Webhook)",
      "Halaman status awam dengan bar sejarah 90 hari",
    ],
  },
  id: {
    title: "UptimeMonke — Pemantauan Infrastruktur & Situs Web Frekuensi Tinggi",
    description:
      "Pemantauan uptime situs web dan API berfrekuensi tinggi dengan pengecekan di bawah satu menit, peringatan kedaluwarsa sertifikat SSL, ping heartbeat cron, notifikasi instan Slack & Discord, serta halaman status publik. 100% gratis selamanya.",
    keywords: [
      "pemantauan situs web",
      "uptime monitor",
      "cek sertifikat SSL",
      "pemantauan cron",
      "halaman status publik",
      "notifikasi downtime",
      "monitoring server",
      "monitoring API",
      "alternatif uptimerobot",
      "monitoring gratis",
    ],
    ogLocale: "id_ID",
    applicationDescription:
      "Pemantauan uptime situs web & API frekuensi tinggi dengan pengecekan sub-menit, pelacakan masa berlaku SSL, heartbeat cron, dan status page publik yang elegan.",
    offersDescription: "Paket gratis dengan 14.400 pengecekan setiap hari selamanya",
    featureList: [
      "Pemantauan uptime HTTP dan kata kunci",
      "Pemantauan port TCP",
      "Verifikasi catatan DNS",
      "Peringatan masa berlaku sertifikat SSL",
      "Pengecekan latensi ping ICMP",
      "Pemantauan heartbeat Cron",
      "Peringatan multi-saluran (Slack, Discord, Email, Webhook)",
      "Halaman status publik elegan dengan riwayat 90 hari",
    ],
  },
  my: {
    title: "UptimeMonke — မြန်နှုန်းမြင့် ဝဘ်ဆိုက်နှင့် အခြေခံအဆောက်အအုံ စောင့်ကြည့်ရေး",
    description:
      "၁ မိနစ်အောက် မြန်နှုန်းမြင့် စစ်ဆေးမှုများ၊ SSL သက်တမ်းကုန်ဆုံးမှု သတိပေးချက်များ၊ Cron heartbeat စောင့်ကြည့်မှု၊ Slack/Discord ချက်ချင်း အသိပေးချက်များနှင့် အများသုံး အခြေအနေ စာမျက်နှာများ ပါဝင်သော အခမဲ့ ဝဘ်ဆိုက် စောင့်ကြည့်ရေး။",
    keywords: [
      "ဝဘ်ဆိုက် စောင့်ကြည့်ရေး",
      "ဆာဗာ စောင့်ကြည့်ရေး",
      "SSL သက်တမ်းကုန်ဆုံးမှု",
      "Cron စောင့်ကြည့်ရေး",
      "အခြေအနေ စာမျက်နှာ",
      "ဆာဗာ ဒေါင်း သတိပေးချက်",
      "အခမဲ့ စောင့်ကြည့်ရေး",
      "အခြေခံအဆောက်အအုံ စောင့်ကြည့်ရေး",
    ],
    ogLocale: "my_MM",
    applicationDescription:
      "၁ မိနစ်အောက် စစ်ဆေးမှုများ၊ SSL သက်တမ်း သတိပေးချက်များ၊ Cron heartbeat နှင့် အများသုံး အခြေအနေ စာမျက်နှာများ ပါဝင်သော အခမဲ့ စောင့်ကြည့်ရေး စနစ်။",
    offersDescription: "နေ့စဉ် အကြိမ် ၁၄,၄၀၀ အခမဲ့ စစ်ဆေးခွင့် (ထာဝရ အခမဲ့)",
    featureList: [
      "HTTP နှင့် စကားလုံး စစ်ဆေးခြင်း စောင့်ကြည့်မှု",
      "TCP Port စောင့်ကြည့်မှု",
      "DNS Record အတည်ပြုခြင်း",
      "SSL သက်တမ်းကုန်ဆုံးမှု ကြိုတင်သတိပေးချက်",
      "ICMP Ping အချိန် ကြာမြင့်မှု စစ်ဆေးခြင်း",
      "Cron Heartbeat စောင့်ကြည့်မှု",
      "ချန်နယ်မျိုးစုံ သတိပေးချက်များ (Slack, Discord, Email, Webhook)",
      "ရက် ၉၀ မှတ်တမ်းပါ အများသုံး အခြေအနေ စာမျက်နှာ",
    ],
  },
};

/**
 * Returns canonical and hreflang alternate language URLs for a given route.
 */
export function getAlternateLanguages(): Record<string, string> {
  return {
    en: `${BASE_URL}/`,
    ja: `${BASE_URL}/ja`,
    ko: `${BASE_URL}/ko`,
    ms: `${BASE_URL}/ms`,
    id: `${BASE_URL}/id`,
    my: `${BASE_URL}/my`,
    "x-default": `${BASE_URL}/`,
  };
}

/**
 * Generates comprehensive Next.js metadata for a given locale and route.
 */
export function getMetadataForLocale(
  locale: SupportedLocale,
  pathname: string = ""
): Metadata {
  const data = LOCALE_SEO[locale] || LOCALE_SEO.en;
  const canonical =
    pathname === "" || pathname === "/" || pathname === "/en"
      ? `${BASE_URL}/`
      : `${BASE_URL}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;

  return {
    metadataBase: new URL(BASE_URL),
    title: data.title,
    description: data.description,
    applicationName: "UptimeMonke",
    authors: [{ name: "UptimeMonke Team", url: BASE_URL }],
    creator: "UptimeMonke",
    publisher: "UptimeMonke",
    category: "technology",
    icons: {
      icon: "/favicon.ico",
      shortcut: "/favicon.ico",
      apple: "/apple-icon.png",
    },
    alternates: {
      canonical,
      languages: getAlternateLanguages(),
    },
    openGraph: {
      title: data.title,
      description: data.description,
      url: canonical,
      siteName: "UptimeMonke",
      type: "website",
      locale: data.ogLocale,
      alternateLocale: SUPPORTED_LOCALES.filter((l) => l.code !== locale).map(
        (l) => LOCALE_SEO[l.code].ogLocale
      ),
      images: [
        {
          url: "/opengraph-image",
          width: 1200,
          height: 630,
          alt: data.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: data.title,
      description: data.description,
      images: ["/opengraph-image"],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
    keywords: data.keywords,
  };
}

/**
 * Generates Schema.org structured data graph (WebSite, Organization, SoftwareApplication, FAQPage)
 * in the requested locale.
 */
export function generateLocalizedStructuredData(locale: SupportedLocale) {
  const data = LOCALE_SEO[locale] || LOCALE_SEO.en;
  const t = TRANSLATIONS[locale] || TRANSLATIONS.en;
  const canonical =
    locale === "en" ? `${BASE_URL}/` : `${BASE_URL}/${locale}`;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${BASE_URL}/#website`,
        url: BASE_URL,
        name: "UptimeMonke",
        description: data.description,
        inLanguage: locale,
        publisher: {
          "@id": `${BASE_URL}/#organization`,
        },
      },
      {
        "@type": "Organization",
        "@id": `${BASE_URL}/#organization`,
        name: "UptimeMonke",
        url: BASE_URL,
        logo: `${BASE_URL}/mascot-128.png`,
        sameAs: [],
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${BASE_URL}/#application`,
        name: "UptimeMonke",
        applicationCategory: "DeveloperApplication",
        operatingSystem: "Web",
        url: canonical,
        inLanguage: locale,
        description: data.applicationDescription,
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
          description: data.offersDescription,
        },
        featureList: data.featureList,
      },
      {
        "@type": "FAQPage",
        "@id": `${canonical}#faq`,
        inLanguage: locale,
        mainEntity: [
          {
            "@type": "Question",
            name: t.faq1Q,
            acceptedAnswer: {
              "@type": "Answer",
              text: t.faq1A,
            },
          },
          {
            "@type": "Question",
            name: t.faq2Q,
            acceptedAnswer: {
              "@type": "Answer",
              text: t.faq2A,
            },
          },
          {
            "@type": "Question",
            name: t.faq3Q,
            acceptedAnswer: {
              "@type": "Answer",
              text: t.faq3A,
            },
          },
          {
            "@type": "Question",
            name: t.faq4Q,
            acceptedAnswer: {
              "@type": "Answer",
              text: t.faq4A,
            },
          },
          {
            "@type": "Question",
            name: t.faq5Q,
            acceptedAnswer: {
              "@type": "Answer",
              text: t.faq5A,
            },
          },
        ],
      },
    ],
  };
}
