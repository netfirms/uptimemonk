export type SupportedLocale = "en" | "ja" | "ko" | "ms" | "id" | "my";

export interface LocaleMeta {
  code: SupportedLocale;
  name: string;
  nativeName: string;
  flag: string;
}

export const SUPPORTED_LOCALES: LocaleMeta[] = [
  { code: "en", name: "English", nativeName: "English", flag: "🇺🇸" },
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
 * Normalizes a raw language code (e.g. "ja-JP", "ko_KR", "in-ID", "ms-MY", "my-MM")
 * to our supported locale code, or undefined if not supported.
 */
export function matchLocale(rawLang: string): SupportedLocale | undefined {
  if (!rawLang) return undefined;
  const clean = rawLang.toLowerCase().trim().replace("_", "-");
  const primary = clean.split("-")[0];

  // Indonesian historically used "in" in older Android / Java specifications
  if (primary === "in" || primary === "id") return "id";
  if (primary === "ja") return "ja";
  if (primary === "ko") return "ko";
  if (primary === "ms") return "ms";
  if (primary === "my") return "my";
  if (primary === "en") return "en";

  return undefined;
}

/**
 * Detects user's locale preference:
 * 1. Saved preference in localStorage
 * 2. navigator.languages or navigator.language
 * 3. Fallback to DEFAULT_LOCALE ("en")
 */
export function detectUserLocale(): SupportedLocale {
  if (typeof window === "undefined") {
    return DEFAULT_LOCALE;
  }

  // 1. Saved preference
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && isSupportedLocale(saved)) {
      return saved;
    }
  } catch {
    // localStorage might be unavailable in private browsing
  }

  // 2. Navigator languages
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

  // 3. Fallback
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
