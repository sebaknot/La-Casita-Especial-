/**
 * Turns stored items into what a day actually looks like: recurring events
 * and routines expanded, one-off events placed, tasks placed on their due
 * date. Pure — shared by the server pages and the unit tests.
 */
import { addDays, minutesOf, normalizeTime, type ISODate } from "./dates.ts";
import { expandDates, nextOccurrence } from "./recurrence.ts";
import type { Item, RoutineCompletion } from "./types.ts";

export interface Occurrence {
  key: string; // item id + date, stable for React
  item: Item;
  date: ISODate;
  start: string | null; // HH:MM
  end: string | null;
  /** Routines: done for this date. Tasks: status done. */
  done: boolean;
  overdue: boolean;
}

function isLive(item: Item): boolean {
  return item.status !== "archived" && item.parent_id === null;
}

export function expandOccurrences(
  items: Item[],
  completions: RoutineCompletion[],
  from: ISODate,
  to: ISODate,
  today: ISODate,
): Occurrence[] {
  const done = new Set(completions.map((c) => `${c.item_id}|${c.on_date}`));
  const out: Occurrence[] = [];

  for (const item of items) {
    if (!isLive(item)) continue;
    const start = normalizeTime(item.start_time);
    const end = normalizeTime(item.end_time);

    if (item.recurrence && item.starts_on && (item.kind === "event" || item.kind === "routine")) {
      for (const date of expandDates(item.recurrence, item.starts_on, item.ends_on, from, to)) {
        out.push({
          key: `${item.id}|${date}`,
          item,
          date,
          start,
          end,
          done: item.kind === "routine" && done.has(`${item.id}|${date}`),
          overdue: false,
        });
      }
      continue;
    }

    if (item.kind === "event" && item.starts_on && item.starts_on >= from && item.starts_on <= to) {
      out.push({ key: `${item.id}|${item.starts_on}`, item, date: item.starts_on, start, end, done: false, overdue: false });
      continue;
    }

    if ((item.kind === "task" || item.kind === "project") && item.due_date) {
      const isDone = item.status === "done";
      // Open tasks that are past due surface on today, flagged.
      if (!isDone && item.due_date < today && from <= today && today <= to) {
        out.push({ key: `${item.id}|${today}`, item, date: today, start, end, done: false, overdue: true });
      } else if (item.due_date >= from && item.due_date <= to) {
        out.push({ key: `${item.id}|${item.due_date}`, item, date: item.due_date, start, end, done: isDone, overdue: false });
      }
    }
  }

  return out.sort(compareOccurrences);
}

/** Overdue first, then timed items by time, then all-day items. */
export function compareOccurrences(a: Occurrence, b: Occurrence): number {
  if (a.date !== b.date) return a.date.localeCompare(b.date);
  if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
  if (a.start && b.start) return minutesOf(a.start) - minutesOf(b.start) || a.item.title.localeCompare(b.item.title);
  if (a.start) return -1;
  if (b.start) return 1;
  return a.item.title.localeCompare(b.item.title);
}

export function groupByDate(occurrences: Occurrence[], from: ISODate, days: number): { date: ISODate; items: Occurrence[] }[] {
  return Array.from({ length: days }, (_, index) => {
    const date = addDays(from, index);
    return { date, items: occurrences.filter((occurrence) => occurrence.date === date) };
  });
}

/** Next date an item happens, for countdowns. */
export function nextDateOf(item: Item, today: ISODate): ISODate | null {
  if (item.recurrence && item.starts_on) return nextOccurrence(item.recurrence, item.starts_on, item.ends_on, today);
  const date = item.starts_on ?? item.due_date;
  return date && date >= today ? date : null;
}

/**
 * Consecutive scheduled days a routine was done, counting back from today.
 * Today counts if done; an open today doesn't break the streak yet.
 */
export function routineStreak(item: Item, completions: RoutineCompletion[], today: ISODate): number {
  if (!item.recurrence || !item.starts_on) return 0;
  const done = new Set(completions.filter((c) => c.item_id === item.id).map((c) => c.on_date));
  const scheduled = expandDates(item.recurrence, item.starts_on, item.ends_on, addDays(today, -400), today).reverse();
  let streak = 0;
  for (const date of scheduled) {
    if (done.has(date)) streak++;
    else if (date === today) continue;
    else break;
  }
  return streak;
}
