import { ConflictBanner } from "@/components/ConflictBanner";
import { EmptyState } from "@/components/EmptyState";
import { ItemRow } from "@/components/ItemRow";
import { PersonFilter } from "@/components/PersonFilter";
import { localeTag } from "@/i18n";
import { findConflicts } from "@/lib/conflicts";
import { addDays, formatDate, hourIn, todayISO } from "@/lib/dates";
import { expandOccurrences, groupByDate, type Occurrence } from "@/lib/occurrences";
import { getCompletions, getItems, getPeople } from "@/lib/queries";
import { getLocale, getT, householdTZ, requireHousehold } from "@/lib/session";

const WEEK_DAYS = 7;

/** Home: today on top, the rest of the week below, color per person. */
export default async function HomePage({ searchParams }: { searchParams: Promise<{ who?: string }> }) {
  const session = await requireHousehold();
  const [t, locale, { who }] = await Promise.all([getT(), getLocale(), searchParams]);
  const tag = localeTag(locale);
  const timezone = householdTZ(session.household);
  const today = todayISO(timezone);
  const last = addDays(today, WEEK_DAYS - 1);

  const [people, items] = await Promise.all([
    getPeople(session.supabase, session.household.id),
    getItems(session.supabase, session.household.id),
  ]);
  const routineIds = items.filter((item) => item.kind === "routine").map((item) => item.id);
  const completions = await getCompletions(session.supabase, routineIds, today);

  const all = expandOccurrences(items, completions, today, last, today);
  const selected = people.find((person) => person.id === who) ?? null;
  // A person's view includes what they're responsible for (e.g. the rides they drive).
  const visible = selected
    ? all.filter((o) => o.item.person_id === selected.id || o.item.responsible_person_id === selected.id)
    : all;
  const conflicts = findConflicts(all).filter(
    (c) => !selected || c.personId === selected.id || c.a.item.person_id === selected.id || c.b.item.person_id === selected.id,
  );

  const days = groupByDate(visible, today, WEEK_DAYS);
  const [todayGroup, ...rest] = days;

  const hour = hourIn(timezone);
  const greeting =
    hour < 5 ? t.greeting.night : hour < 12 ? t.greeting.morning : hour < 18 ? t.greeting.afternoon : t.greeting.evening;

  return (
    <div className="space-y-6">
      <div className="rise-in">
        <p className="text-ink-dim">{formatDate(today, tag, { weekday: "long", month: "long", day: "numeric" })}</p>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{greeting}</h1>
      </div>

      <PersonFilter
        people={people}
        selected={selected?.id ?? null}
        basePath="/"
        allLabel={t.home.everyone}
        label={t.home.filterBy}
      />

      <ConflictBanner conflicts={conflicts} people={people} t={t} locale={tag} />

      <section aria-labelledby="today-title">
        <h2 id="today-title" className="mb-2 text-lg font-semibold">
          {t.home.today}
        </h2>
        {todayGroup.items.length === 0 ? (
          <EmptyState
            message={selected ? t.home.nothingTodayFor(selected.name) : t.home.nothingToday}
            actionLabel={t.nav.add}
            href={`/add?date=${today}${selected ? `&who=${selected.id}` : ""}`}
          />
        ) : (
          <ul className="grid gap-2 lg:grid-cols-2">
            {todayGroup.items.map((occurrence) => (
              <ItemRow key={occurrence.key} occurrence={occurrence} />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="week-title">
        <h2 id="week-title" className="mb-2 text-lg font-semibold">
          {t.home.thisWeek}
        </h2>
        <div className="grid gap-4 lg:grid-cols-3 2xl:grid-cols-6">
          {rest.map((day) => (
            <DayColumn key={day.date} date={day.date} items={day.items} label={formatDate(day.date, tag, { weekday: "long", month: "short", day: "numeric" })} empty={t.home.nothingDay} />
          ))}
        </div>
      </section>
    </div>
  );
}

function DayColumn({ date, items, label, empty }: { date: string; items: Occurrence[]; label: string; empty: string }) {
  return (
    <section aria-labelledby={`day-${date}`} className="rounded-xl bg-sunk/60 p-2.5">
      <h3 id={`day-${date}`} className="mb-2 px-1 font-semibold capitalize text-ink">
        {label}
      </h3>
      {items.length === 0 ? (
        <p className="px-1 pb-1 text-ink-faint">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((occurrence) => (
            <ItemRow key={occurrence.key} occurrence={occurrence} compact />
          ))}
        </ul>
      )}
    </section>
  );
}
