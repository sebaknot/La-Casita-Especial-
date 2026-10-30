import Link from "next/link";
import { EmptyState } from "@/components/EmptyState";
import { PersonChip } from "@/components/PersonChip";
import { ProgressRing } from "@/components/ProgressRing";
import { Icon } from "@/components/icons";
import { localeTag, pillarName } from "@/i18n";
import { daysBetween, formatDate, todayISO } from "@/lib/dates";
import { nextDateOf } from "@/lib/occurrences";
import { getItems, getPeople } from "@/lib/queries";
import { nextOccurrence } from "@/lib/recurrence";
import { getLocale, getT, householdTZ, requireHousehold } from "@/lib/session";
import { stepProgress } from "@/lib/types";

export default async function CountdownsPage() {
  const session = await requireHousehold();
  const [t, locale] = await Promise.all([getT(), getLocale()]);
  const tag = localeTag(locale);
  const today = todayISO(householdTZ(session.household));
  const [items, people] = await Promise.all([
    getItems(session.supabase, session.household.id),
    getPeople(session.supabase, session.household.id),
  ]);

  const entries = [
    ...items
      .filter((item) => item.countdown && item.parent_id === null && item.status !== "done")
      .map((item) => ({ key: item.id, date: nextDateOf(item, today), title: item.title, item, person: null as (typeof people)[number] | null })),
    ...people
      .filter((person) => person.birthday)
      .map((person) => ({
        key: `birthday-${person.id}`,
        date: nextOccurrence("FREQ=YEARLY", person.birthday!, null, today),
        title: t.countdowns.birthday(person.name),
        item: null,
        person,
      })),
  ]
    .filter((entry): entry is typeof entry & { date: string } => Boolean(entry.date))
    .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t.countdowns.title}</h1>
        <p className="text-ink-dim">{t.countdowns.intro}</p>
      </div>
      {entries.length === 0 ? (
        <EmptyState message={t.countdowns.empty} actionLabel={t.countdowns.addTrip} href="/add?pillar=family&kind=project&back=/countdowns" icon="hourglass" />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {entries.map((entry) => {
            const days = daysBetween(today, entry.date);
            const steps = entry.item?.kind === "project" ? stepProgress(entry.item.id, items) : null;
            const body = (
              <>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="tabular text-4xl font-semibold tracking-tight text-primary-strong">
                    {days === 0 ? t.countdowns.today : t.countdowns.daysLeft(days)}
                  </p>
                  {steps && steps.total > 0 && (
                    <ProgressRing value={steps.done} max={steps.total} size={44} label={t.item.steps(steps.done, steps.total)} center={`${steps.done}/${steps.total}`} />
                  )}
                </div>
                <p className="mt-1 text-lg font-semibold text-ink">{entry.title}</p>
                <p className="text-ink-dim">
                  {formatDate(entry.date, tag, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {entry.person && <PersonChip person={entry.person} size="sm" />}
                  {entry.item && <span className="rounded-full bg-sunk px-2 py-0.5 text-xs text-ink-dim">{pillarName(t, entry.item.pillar_key)}</span>}
                </div>
                {entry.item?.details && <p className="mt-2 text-sm text-ink-dim">{entry.item.details}</p>}
              </>
            );
            return (
              <li key={entry.key}>
                {entry.item ? (
                  <Link href={`/item/${entry.item.id}`} className="block rounded-2xl border border-line bg-surface p-4 hover:border-primary/50">
                    {body}
                  </Link>
                ) : (
                  <div className="rounded-2xl border border-line bg-surface p-4">
                    <Icon name="gift" className="mb-1 h-5 w-5 text-primary" />
                    {body}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
