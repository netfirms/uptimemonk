"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/context";
import type { SupportedLocale } from "@/lib/i18n/locales";

interface LanguagePickerProps {
  className?: string;
  compact?: boolean;
}

export default function LanguagePicker({
  className = "",
  compact = false,
}: LanguagePickerProps) {
  const { locale, setLocale, locales, currentLocaleMeta } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  function handleSelect(e: React.MouseEvent, newLocale: SupportedLocale) {
    setLocale(newLocale);
    setIsOpen(false);

    // If inside modal or dashboard, don't navigate away
    if (typeof window !== "undefined") {
      const pathname = window.location.pathname;
      const isLanding =
        pathname === "/" ||
        locales.some((l) => pathname === `/${l.code}` || pathname === `/${l.code}/`);
      if (!isLanding) {
        e.preventDefault();
      }
    }
  }

  return (
    <div
      ref={containerRef}
      className={`lang-picker-wrap ${className}`}
      style={{ position: "relative", display: "inline-block" }}
    >
      <button
        type="button"
        className={`lang-picker-btn ${isOpen ? "open" : ""}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        title="Select Language / 言語選択 / 언어 선택 / Bahasa / ဘာသာစကား"
      >
        <span className="lang-picker-flag" aria-hidden="true">
          {currentLocaleMeta.flag}
        </span>
        {!compact && (
          <span className="lang-picker-name">{currentLocaleMeta.nativeName}</span>
        )}
        <svg
          className={`lang-picker-chevron ${isOpen ? "rotate" : ""}`}
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isOpen && (
        <div className="lang-picker-menu" role="listbox" aria-label="Languages">
          <div className="lang-picker-header">
            <span>Select Language</span>
          </div>
          <div className="lang-picker-list">
            {locales.map((item) => {
              const isSelected = item.code === locale;
              const targetHref = item.code === "en" ? "/" : `/${item.code}`;

              return (
                <Link
                  key={item.code}
                  href={targetHref}
                  hrefLang={item.code}
                  role="option"
                  aria-selected={isSelected}
                  className={`lang-picker-item ${isSelected ? "active" : ""}`}
                  onClick={(e) => handleSelect(e, item.code)}
                >
                  <span className="lang-item-flag" aria-hidden="true">
                    {item.flag}
                  </span>
                  <div className="lang-item-text">
                    <span className="lang-item-native">{item.nativeName}</span>
                    <span className="lang-item-en">{item.name}</span>
                  </div>
                  {isSelected && (
                    <svg
                      className="lang-item-check"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#3fa9c9"
                      strokeWidth="2.5"
                      aria-hidden="true"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
