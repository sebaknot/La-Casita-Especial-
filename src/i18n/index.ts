/**
 * Adding a language: create xx.ts typed as `Dictionary`, then add it to
 * LOCALES below. The compiler lists every missing string.
 */
import type { PillarKey } from "../config/pillars.ts";
import type { LocaleTag } from "../lib/dates.ts";
import { en, type Dictionary } from "./en.ts";
import { es } from "./es.ts";

export type Locale = "en" | "es";

export const LOCALES: Record<Locale, Dictionary> = { en, es };
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "lang";

// A pillar added to PillarKey without a name in the dictionary fails here.
const pillarNamesComplete: Record<PillarKey, { name: string; blurb: string }> = en.pillars;
void pillarNamesComplete;

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(LOCALES, value);
}

export function dict(locale: Locale): Dictionary {
  return LOCALES[locale] ?? LOCALES[DEFAULT_LOCALE];
}

export function localeTag(locale: Locale): LocaleTag {
  return dict(locale).locale as LocaleTag;
}

export function pillarName(t: Dictionary, key: string): string {
  return (t.pillars as Record<string, { name: string }>)[key]?.name ?? key;
}

export function tagLabel(t: Dictionary, tag: string | null): string | null {
  if (!tag) return null;
  return (t.tags as Record<string, string>)[tag] ?? tag.replace(/_/g, " ");
}

export type { Dictionary };
