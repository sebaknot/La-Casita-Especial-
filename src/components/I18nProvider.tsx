"use client";

import { createContext, useContext } from "react";
import { dict, localeTag, type Dictionary, type Locale } from "@/i18n";
import type { LocaleTag } from "@/lib/dates";

interface I18nValue {
  locale: Locale;
  tag: LocaleTag;
  t: Dictionary;
}

const I18nContext = createContext<I18nValue>({ locale: "en", tag: "en-US", t: dict("en") });

/**
 * Dictionaries contain formatter functions, which can't cross the
 * server→client boundary — so only the locale string is passed down and the
 * client picks its own copy of the dictionary.
 */
export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <I18nContext.Provider value={{ locale, tag: localeTag(locale), t: dict(locale) }}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  return useContext(I18nContext);
}
