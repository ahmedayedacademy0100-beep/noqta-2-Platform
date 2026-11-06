import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ar, en } from "./dictionary";

export type Language = "en" | "ar";
export type Direction = "ltr" | "rtl";

const STORAGE_KEY = "noor.language";

type I18nValue = {
  lang: Language;
  dir: Direction;
  isRtl: boolean;
  setLanguage: (lang: Language, options?: { persist?: boolean }) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  /** Picks the field that matches the active language from a bilingual pair. */
  pick: <T>(enValue: T, arValue: T) => T;
  formatDate: (timestamp: number | undefined, withTime?: boolean) => string;
  formatNumber: (value: number, digits?: number) => string;
};

const I18nContext = createContext<I18nValue | null>(null);

function detectInitialLanguage(): Language {
  if (typeof window === "undefined") return "en";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "ar" || stored === "en") return stored;
  return window.navigator.language?.toLowerCase().startsWith("ar") ? "ar" : "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Language>(detectInitialLanguage);

  const dir: Direction = lang === "ar" ? "rtl" : "ltr";

  useEffect(() => {
    const root = document.documentElement;
    root.lang = lang;
    root.dir = dir;
    root.classList.toggle("lang-ar", lang === "ar");
    window.localStorage.setItem(STORAGE_KEY, lang);
  }, [lang, dir]);

  const setLanguage = useCallback(
    (next: Language, options?: { persist?: boolean }) => {
      setLang(next);
      if (options?.persist === false) {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    },
    [],
  );

  const value = useMemo<I18nValue>(() => {
    const table = lang === "ar" ? ar : en;
    const t = (key: string, params?: Record<string, string | number>) => {
      const raw = table[key] ?? en[key] ?? key;
      if (!params) return raw;
      return raw.replace(/\{(\w+)\}/g, (match, name: string) =>
        params[name] !== undefined ? String(params[name]) : match,
      );
    };
    const locale = lang === "ar" ? "ar-EG" : "en-GB";
    return {
      lang,
      dir,
      isRtl: dir === "rtl",
      setLanguage,
      t,
      pick: <T,>(enValue: T, arValue: T) => (lang === "ar" ? arValue : enValue),
      formatDate: (timestamp?: number, withTime?: boolean) => {
        if (!timestamp) return "—";
        const date = new Date(timestamp);
        const datePart = new Intl.DateTimeFormat(locale, {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }).format(date);
        if (!withTime) return datePart;
        const timePart = new Intl.DateTimeFormat(locale, {
          hour: "2-digit",
          minute: "2-digit",
        }).format(date);
        return `${datePart} · ${timePart}`;
      },
      formatNumber: (number: number, digits = 0) =>
        new Intl.NumberFormat(locale, {
          minimumFractionDigits: digits,
          maximumFractionDigits: digits,
        }).format(number),
    };
  }, [lang, dir, setLanguage]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used inside <I18nProvider>");
  }
  return context;
}

export function relativeTime(timestamp: number, lang: Language): string {
  const diff = timestamp - Date.now();
  const formatter = new Intl.RelativeTimeFormat(lang === "ar" ? "ar" : "en", {
    numeric: "auto",
  });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["day", 24 * 60 * 60 * 1000],
    ["hour", 60 * 60 * 1000],
    ["minute", 60 * 1000],
    ["second", 1000],
  ];
  for (const [unit, ms] of units) {
    if (Math.abs(diff) >= ms || unit === "second") {
      return formatter.format(Math.round(diff / ms), unit);
    }
  }
  return "";
}
