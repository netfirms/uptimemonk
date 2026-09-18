export type SupportedLocale = "en" | "ja" | "ko" | "ms" | "id" | "my" | "zh";

export interface LocaleMeta {
  code: SupportedLocale;
  name: string;
  nativeName: string;
  flag: string;
}

export const SUPPORTED_LOCALES: LocaleMeta[] = [
  { code: "en", name: "English", nativeName: "English", flag: "🇺🇸" },
  { code: "zh", name: "Chinese", nativeName: "简体中文", flag: "🇨🇳" },
  { code: "ja", name: "Japanese", nativeName: "日本語", flag: "🇯🇵" },
  { code: "ko", name: "Korean", nativeName: "한국어", flag: "🇰🇷" },
  { code: "ms", name: "Malay", nativeName: "Bahasa Melayu", flag: "🇲🇾" },
  { code: "id", name: "Indonesian", nativeName: "Bahasa Indonesia", flag: "🇮🇩" },
  { code: "my", name: "Burmese", nativeName: "မြန်မာစာ", flag: "🇲🇲" },
];

export const DEFAULT_LOCALE: SupportedLocale = "en";
export const STORAGE_KEY = "uptimemonke_locale";

/**
 * Checks if a string is one of our supported locales.
 */
export function isSupportedLocale(code: string): code is SupportedLocale {
  return SUPPORTED_LOCALES.some((l) => l.code === code);
}

/**
 * Normalizes a raw language code (e.g. "zh-CN", "ja-JP", "ko_KR", "in-ID", "ms-MY", "my-MM")
 * to our supported locale code, or undefined if not supported.
 */
export function matchLocale(rawLang: string): SupportedLocale | undefined {
  if (!rawLang) return undefined;
  const clean = rawLang.toLowerCase().trim().replace("_", "-");
  const primary = clean.split("-")[0];

  // Indonesian historically used "in" in older Android / Java specifications
  if (primary === "in" || primary === "id") return "id";
  if (primary === "zh") return "zh";
  if (primary === "ja") return "ja";
  if (primary === "ko") return "ko";
  if (primary === "ms") return "ms";
  if (primary === "my") return "my";
  if (primary === "en") return "en";

  return undefined;
}

/**
 * Detects user's locale preference:
 * 1. URL pathname (e.g. /ja, /ko, /ms, /id, /my, /en)
 * 2. URL search params (e.g. ?lang=ja or ?locale=ja)
 * 3. Saved preference in localStorage
 * 4. navigator.languages or navigator.language
 * 5. Fallback to DEFAULT_LOCALE ("en")
 */
export function detectUserLocale(): SupportedLocale {
  if (typeof window === "undefined") {
    return DEFAULT_LOCALE;
  }

  // 1. URL pathname
  try {
    const segments = window.location.pathname.split("/").filter(Boolean);
    if (segments.length > 0) {
      const firstSegment = segments[0].toLowerCase();
      if (isSupportedLocale(firstSegment)) {
        return firstSegment;
      }
    }
  } catch {
    // Ignore location errors
  }

  // 2. URL search parameters (?lang= or ?locale=)
  try {
    const params = new URLSearchParams(window.location.search);
    const langParam = params.get("lang") || params.get("locale");
    if (langParam) {
      const matched = matchLocale(langParam);
      if (matched) return matched;
    }
  } catch {
    // Ignore URL search errors
  }

  // 3. Saved preference
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && isSupportedLocale(saved)) {
      return saved;
    }
  } catch {
    // localStorage might be unavailable in private browsing
  }

  // 4. Navigator languages
  if (navigator.languages && navigator.languages.length > 0) {
    for (const lang of navigator.languages) {
      const matched = matchLocale(lang);
      if (matched) return matched;
    }
  }

  if (navigator.language) {
    const matched = matchLocale(navigator.language);
    if (matched) return matched;
  }

  // 5. Fallback
  return DEFAULT_LOCALE;
}

/**
 * Persists locale to localStorage and updates <html lang="..."> attribute.
 */
export function applyLocale(locale: SupportedLocale): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // Ignore storage errors
  }

  if (document.documentElement) {
    document.documentElement.lang = locale;
    if (locale === "my") {
      document.documentElement.setAttribute("data-locale", "my");
    } else {
      document.documentElement.removeAttribute("data-locale");
    }
  }
}
