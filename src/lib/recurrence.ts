/**
 * A small RRULE expander covering what a household schedule needs:
 *   FREQ=DAILY[;INTERVAL=n]
 *   FREQ=WEEKLY[;INTERVAL=n];BYDAY=MO,WE
 *   FREQ=MONTHLY;BYDAY=1SA | -1FR      (nth weekday of the month)
 *   FREQ=MONTHLY[;BYMONTHDAY=15]
 *   FREQ=YEARLY                        (same month/day as starts_on)
 * Rules are stored without DTSTART; `starts_on` / `ends_on` bound them.
 */
import { addDays, daysBetween, toUTC, weekdayOf, WEEKDAYS, type ISODate, type Weekday } from "./dates.ts";

export interface ParsedRule {
  freq: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
  interval: number;
  byDay: { day: Weekday; nth: number | null }[];
  byMonthDay: number | null;
}

export function parseRule(rule: string): ParsedRule | null {
  const parts = Object.fromEntries(
    rule
      .split(";")
      .map((part) => part.split("="))
      .filter((kv) => kv.length === 2)
      .map(([k, v]) => [k.toUpperCase(), v.toUpperCase()]),
  );
  const freq = parts.FREQ;
  if (freq !== "DAILY" && freq !== "WEEKLY" && freq !== "MONTHLY" && freq !== "YEARLY") return null;

  const interval = Math.max(1, Number(parts.INTERVAL ?? 1) || 1);
  const byDay = (parts.BYDAY ?? "")
    .split(",")
    .filter(Boolean)
    .map((token: string) => {
      const match = /^([+-]?\d)?(MO|TU|WE|TH|FR|SA|SU)$/.exec(token);
      return match ? { day: match[2] as Weekday, nth: match[1] ? Number(match[1]) : null } : null;
    })
    .filter((entry: unknown): entry is { day: Weekday; nth: number | null } => entry !== null);
  const byMonthDay = parts.BYMONTHDAY ? Number(parts.BYMONTHDAY) || null : null;

  return { freq, interval, byDay, byMonthDay };
}

/** Builds a weekly rule from weekday chips. */
export function weeklyRule(days: Weekday[]): string {
  const ordered = WEEKDAYS.filter((day) => days.includes(day));
  return `FREQ=WEEKLY;BYDAY=${ordered.join(",")}`;
}

/** Weekdays of a simple weekly rule, for editing it back as chips. */
export function weeklyDays(rule: string | null): Weekday[] {
  if (!rule) return [];
  const parsed = parseRule(rule);
  if (!parsed || parsed.freq !== "WEEKLY") return [];
  return parsed.byDay.filter((entry) => entry.nth === null).map((entry) => entry.day);
}

function nthWeekdayOfMonth(iso: ISODate): { nth: number; fromEnd: number } {
  const date = toUTC(iso);
  const day = date.getUTCDate();
  const daysInMonth = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  return { nth: Math.ceil(day / 7), fromEnd: -Math.ceil((daysInMonth - day + 1) / 7) };
}

function monthsBetween(from: ISODate, to: ISODate): number {
  const a = toUTC(from);
  const b = toUTC(to);
  return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
}

/** Does the rule (anchored at startsOn) produce an occurrence on `date`? */
export function occursOn(
  rule: ParsedRule,
  startsOn: ISODate,
  endsOn: ISODate | null,
  date: ISODate,
): boolean {
  if (date < startsOn) return false;
  if (endsOn && date > endsOn) return false;
  const weekday = weekdayOf(date);

  switch (rule.freq) {
    case "DAILY":
      return daysBetween(startsOn, date) % rule.interval === 0 &&
        (rule.byDay.length === 0 || rule.byDay.some((entry) => entry.day === weekday));
    case "WEEKLY": {
      // Weeks counted Monday-based from the week containing startsOn.
      const startMonday = addDays(startsOn, -WEEKDAYS.indexOf(weekdayOf(startsOn)));
      const weekIndex = Math.floor(daysBetween(startMonday, date) / 7);
      if (weekIndex % rule.interval !== 0) return false;
      const days = rule.byDay.length > 0 ? rule.byDay.map((entry) => entry.day) : [weekdayOf(startsOn)];
      return days.includes(weekday);
    }
    case "MONTHLY": {
      if (monthsBetween(startsOn, date) % rule.interval !== 0) return false;
      if (rule.byDay.length > 0) {
        const { nth, fromEnd } = nthWeekdayOfMonth(date);
        return rule.byDay.some(
          (entry) => entry.day === weekday && (entry.nth === null || entry.nth === nth || entry.nth === fromEnd),
        );
      }
      const monthDay = rule.byMonthDay ?? toUTC(startsOn).getUTCDate();
      return toUTC(date).getUTCDate() === monthDay;
    }
    case "YEARLY":
      return date.slice(5) === startsOn.slice(5);
  }
}

/** All occurrence dates within [from, to], inclusive. */
export function expandDates(
  ruleText: string,
  startsOn: ISODate,
  endsOn: ISODate | null,
  from: ISODate,
  to: ISODate,
): ISODate[] {
  const rule = parseRule(ruleText);
  if (!rule) return [];
  const dates: ISODate[] = [];
  let cursor = from < startsOn ? startsOn : from;
  const last = endsOn && endsOn < to ? endsOn : to;
  while (cursor <= last) {
    if (occursOn(rule, startsOn, endsOn, cursor)) dates.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return dates;
}

/** The first occurrence on or after `from`, searching up to ~2 years ahead. */
export function nextOccurrence(
  ruleText: string,
  startsOn: ISODate,
  endsOn: ISODate | null,
  from: ISODate,
): ISODate | null {
  const rule = parseRule(ruleText);
  if (!rule) return null;
  let cursor = from < startsOn ? startsOn : from;
  for (let i = 0; i < 800; i++) {
    if (endsOn && cursor > endsOn) return null;
    if (occursOn(rule, startsOn, endsOn, cursor)) return cursor;
    cursor = addDays(cursor, 1);
  }
  return null;
}
