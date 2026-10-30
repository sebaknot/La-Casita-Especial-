import type { Dictionary } from "@/i18n";
import { formatTime, type LocaleTag } from "@/lib/dates";
import { parseRule } from "@/lib/recurrence";
import type { Item } from "@/lib/types";

/** "Mon, Wed · 5:15 PM" — a human summary of when something repeats. */
export function describeSchedule(item: Item, t: Dictionary, locale: LocaleTag): string {
  const parts: string[] = [];
  const rule = item.recurrence ? parseRule(item.recurrence) : null;
  if (rule) {
    if (rule.freq === "DAILY") parts.push(t.form.repeatDaily);
    else if (rule.freq === "WEEKLY") parts.push(rule.byDay.map((entry) => t.weekdays[entry.day]).join(", ") || t.form.repeatWeekly);
    else if (rule.freq === "MONTHLY") {
      const first = rule.byDay[0];
      parts.push(first?.nth ? `${t.form.repeatMonthly} · ${first.nth}º ${t.weekdays[first.day]}` : t.form.repeatMonthly);
    } else parts.push(t.form.repeatYearly);
  }
  if (item.start_time) {
    parts.push(`${formatTime(item.start_time.slice(0, 5), locale)}${item.end_time ? `–${formatTime(item.end_time.slice(0, 5), locale)}` : ""}`);
  }
  return parts.join(" · ");
}
