/**
 * Calendar math on plain YYYY-MM-DD strings, in the household's timezone.
 *
 * Schedules are stored as local dates + local times (no timestamps), so the
 * only place a timezone matters is "what is today?". Everything else is
 * date arithmetic done in UTC to stay DST-proof.
 */

export type ISODate = string; // YYYY-MM-DD
export type Weekday = "MO" | "TU" | "WE" | "TH" | "FR" | "SA" | "SU";

export const WEEKDAYS: Weekday[] = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];

export const DEFAULT_TZ = "America/New_York";

/** Today's date in the given timezone. */
export function todayISO(timeZone: string = DEFAULT_TZ, now: Date = new Date()): ISODate {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Current hour (0–23) in the given timezone. */
export function hourIn(timeZone: string = DEFAULT_TZ, now: Date = new Date()): number {
  return Number(
    new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", hourCycle: "h23" }).format(now),
  );
}

export function toUTC(iso: ISODate): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function fromUTC(date: Date): ISODate {
  return date.toISOString().slice(0, 10);
}

export function addDays(iso: ISODate, days: number): ISODate {
  const date = toUTC(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return fromUTC(date);
}

export function daysBetween(from: ISODate, to: ISODate): number {
  return Math.round((toUTC(to).getTime() - toUTC(from).getTime()) / 86_400_000);
}

export function weekdayOf(iso: ISODate): Weekday {
  // getUTCDay: 0 = Sunday
  return WEEKDAYS[(toUTC(iso).getUTCDay() + 6) % 7];
}

export function isISODate(value: unknown): value is ISODate {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(toUTC(value).getTime());
}

/** "07:30:00" | "07:30" → "07:30"; anything else → null. */
export function normalizeTime(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{1,2}):(\d{2})/.exec(value.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return `${String(h).padStart(2, "0")}:${match[2]}`;
}

export function minutesOf(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export type LocaleTag = "en-US" | "es-US";

/** "2:50 PM" / "2:50 p. m." */
export function formatTime(time: string | null, locale: LocaleTag): string {
  if (!time) return "";
  const [h, m] = time.split(":").map(Number);
  return new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit", timeZone: "UTC" }).format(
    new Date(Date.UTC(2000, 0, 1, h, m)),
  );
}

export function formatDate(
  iso: ISODate,
  locale: LocaleTag,
  options: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" },
): string {
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" }).format(toUTC(iso));
}

