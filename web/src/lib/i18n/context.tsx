"use client";

import React, { createContext, useContext, useEffect, useState, useMemo } from "react";
import {
  type SupportedLocale,
  type LocaleMeta,
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  detectUserLocale,
  applyLocale,
} from "./locales";
import { TRANSLATIONS, type Translations } from "./translations";

export interface I18nContextValue {
  locale: SupportedLocale;
  setLocale: (newLocale: SupportedLocale) => void;
  t: (key: keyof Translations) => string;
  locales: LocaleMeta[];
  currentLocaleMeta: LocaleMeta;
  isHydrated: boolean;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<SupportedLocale>(DEFAULT_LOCALE);
  const [isHydrated, setIsHydrated] = useState(false);

  // Client hydration & detection
  useEffect(() => {
    const detected = detectUserLocale();
    setLocaleState(detected);
    applyLocale(detected);
    setIsHydrated(true);
  }, []);

  const setLocale = (newLocale: SupportedLocale) => {
    setLocaleState(newLocale);
    applyLocale(newLocale);
  };

  const currentLocaleMeta = useMemo(() => {
    return (
      SUPPORTED_LOCALES.find((l) => l.code === locale) ||
      SUPPORTED_LOCALES[0]
    );
  }, [locale]);

  const t = useMemo(() => {
    return (key: keyof Translations): string => {
      const activeDict = TRANSLATIONS[locale];
      if (activeDict && activeDict[key]) {
        return activeDict[key];
      }
      // Fallback to English
      return TRANSLATIONS[DEFAULT_LOCALE][key] || (key as string);
    };
  }, [locale]);

  const value: I18nContextValue = useMemo(
    () => ({
      locale,
      setLocale,
      t,
      locales: SUPPORTED_LOCALES,
      currentLocaleMeta,
      isHydrated,
    }),
    [locale, currentLocaleMeta, isHydrated, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // Graceful fallback for components rendered outside of I18nProvider
    const fallbackT = (key: keyof Translations): string => {
      return TRANSLATIONS[DEFAULT_LOCALE][key] || (key as string);
    };
    return {
      locale: DEFAULT_LOCALE,
      setLocale: () => {},
      t: fallbackT,
      locales: SUPPORTED_LOCALES,
      currentLocaleMeta: SUPPORTED_LOCALES[0],
      isHydrated: false,
    };
  }
  return ctx;
}
