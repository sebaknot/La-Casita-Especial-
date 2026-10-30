import Link from "next/link";
import { ConflictBanner } from "@/components/ConflictBanner";
import { EmptyState } from "@/components/EmptyState";
import { ItemRow } from "@/components/ItemRow";
import { PersonChip } from "@/components/PersonChip";
import { RoutineCard } from "@/components/RoutineCard";
import { Icon } from "@/components/icons";
import { DriverSelect } from "@/components/pillars/DriverSelect";
import { Section } from "@/components/pillars/ListPillar";
import { TemplateCard } from "@/components/pillars/TemplateCard";
import { tagLabel, type Dictionary } from "@/i18n";
import { findConflicts } from "@/lib/conflicts";
import { describeSchedule } from "@/lib/describe";
import { addDays, formatDate, formatTime, type LocaleTag } from "@/lib/dates";
import { expandOccurrences, groupByDate, nextDateOf, routineStreak } from "@/lib/occurrences";
import {
  isRide,
  KIDS_REMINDER_TAGS,
  type Household,
  type Item,
  type Person,
  type RoutineCompletion,
  type ScheduleTemplate,
} from "@/lib/types";

const DAYS = 7;

export function KidsPillar({
  household,
  items,
  people,
  completions,
  templates,
  today,
  t,
  locale,
}: {
  household: Household;
  items: Item[];
  people: Person[];
  completions: RoutineCompletion[];
  templates: ScheduleTemplate[];
  today: string;
  t: Dictionary;
  locale: LocaleTag;
}) {
  const children = people.filter((person) => person.relation === "child");
  const week = expandOccurrences(items, completions, today, addDays(today, DAYS - 1), today);
  const rides = groupByDate(
    week.filter((o) => isRide(o.item.tag)),
    today,
    DAYS,
  ).filter((day) => day.items.length > 0);
  const conflicts = findConflicts(week);

  const reminderTags = KIDS_REMINDER_TAGS as readonly string[];
  const reminders = items
    .filter((item) => item.kind === "task" && item.status !== "done" && item.parent_id === null)
    .filter((item) => !item.tag || reminderTags.includes(item.tag))
    .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"));
  const routines = items.filter((item) => item.kind === "routine");
  const routineToday = new Map(expandOccurrences(routines, completions, today, today, today).map((o) => [o.item.id, o]));

  return (
    <div className="space-y-7">
      <ConflictBanner conflicts={conflicts} people={people} t={t} locale={locale} />

      <Section title={t.kids.rides} note={t.kids.ridesNote}>
        {rides.length === 0 ? (
          <EmptyState message={t.kids.noRides} actionLabel={t.nav.add} href="/add?pillar=kids&kind=event&tag=pickup&back=/p/kids" icon="car" />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {rides.map((day) => (
              <div key={day.date} className="rounded-xl bg-sunk/60 p-2.5">
                <h3 className="mb-1.5 px-1 font-semibold capitalize">
                  {day.date === today ? t.home.today : formatDate(day.date, locale, { weekday: "long", month: "short", day: "numeric" })}
                </h3>
                <ul className="space-y-1.5">
                  {day.items.map((ride) => (
                    <li key={ride.key} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl bg-surface px-3 py-2">
                      <span className="tabular w-20 shrink-0 font-semibold text-ink-dim">{formatTime(ride.start, locale)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{tagLabel(t, ride.item.tag)}</span>
                        <span className="flex flex-wrap items-center gap-1.5 text-sm text-ink-dim">
                          <PersonChip person={people.find((p) => p.id === ride.item.person_id) ?? null} size="sm" />
                          {ride.item.location && (
                            <span className="inline-flex items-center gap-1">
                              <Icon name="pin" className="h-3.5 w-3.5" />
                              {ride.item.location}
                            </span>
                          )}
                        </span>
                      </span>
                      <DriverSelect itemId={ride.item.id} title={ride.item.title} driverId={ride.item.responsible_person_id} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        {children.map((child) => {
          const mine = groupByDate(
            week.filter((o) => o.item.person_id === child.id && !isRide(o.item.tag) && o.item.kind !== "task"),
            today,
            DAYS,
          ).filter((day) => day.items.length > 0);
          return (
            <Section key={child.id} title={t.kids.scheduleFor(child.name)}>
              {mine.length === 0 ? (
                <EmptyState
                  message={t.kids.nothingFor(child.name)}
                  actionLabel={t.nav.add}
                  href={`/add?pillar=kids&kind=event&who=${child.id}&back=/p/kids`}
                />
              ) : (
                <div className="space-y-3">
                  {mine.map((day) => (
                    <div key={day.date}>
                      <h3 className="eyebrow mb-1">
                        {day.date === today ? t.home.today : formatDate(day.date, locale, { weekday: "long", day: "numeric" })}
                      </h3>
                      <ul className="space-y-1.5">
                        {day.items.map((occurrence) => (
                          <ItemRow key={occurrence.key} occurrence={occurrence} compact />
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title={t.kids.reminders}>
          {reminders.length === 0 ? (
            <EmptyState message={t.kids.remindersEmpty} />
          ) : (
            <ul className="space-y-2">
              {reminders.map((item) => (
                <ItemRow
                  key={item.id}
                  occurrence={{
                    key: item.id,
                    item,
                    date: item.due_date ?? today,
                    start: null,
                    end: null,
                    done: false,
                    overdue: Boolean(item.due_date && item.due_date < today),
                  }}
                />
              ))}
            </ul>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {(["homework", "supplies", "uniform", "school_event", "teacher_meeting"] as const).map((tag) => (
              <Link
                key={tag}
                href={`/add?pillar=kids&kind=task&tag=${tag}&back=/p/kids`}
                className="inline-flex min-h-11 items-center gap-1 rounded-full border border-line bg-surface px-3 text-sm font-medium text-ink-dim hover:text-ink"
              >
                <Icon name="plus" className="h-3.5 w-3.5" />
                {tagLabel(t, tag)}
              </Link>
            ))}
          </div>
        </Section>

        <div className="space-y-6">
          {routines.length > 0 && (
            <Section title={t.pillar.routines}>
              <ul className="space-y-2">
                {routines.map((routine) => {
                  const occurrence = routineToday.get(routine.id);
                  const next = occurrence ? null : nextDateOf(routine, today);
                  return (
                    <RoutineCard
                      key={routine.id}
                      id={routine.id}
                      title={routine.title}
                      schedule={describeSchedule(routine, t, locale)}
                      today={today}
                      dueToday={Boolean(occurrence)}
                      doneToday={occurrence?.done ?? false}
                      streak={routineStreak(routine, completions, today)}
                      nextLabel={next ? formatDate(next, locale) : null}
                    />
                  );
                })}
              </ul>
            </Section>
          )}

          <Section title={t.kids.schoolEvents}>
            {household.school_events_url ? (
              <a
                href={household.school_events_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary-soft px-4 font-semibold text-primary-strong"
              >
                <Icon name="link" className="h-4 w-4" />
                {t.kids.openSchoolEvents}
              </a>
            ) : (
              <EmptyState message={t.kids.schoolEventsMissing} actionLabel={t.nav.settings} href="/settings" icon="link" />
            )}
          </Section>
        </div>
      </div>

      {templates.length > 0 && (
        <Section title={t.kids.schoolTemplate}>
          <div className="grid gap-4 lg:grid-cols-2">
            {templates.map((template) => (
              <TemplateCard
                key={template.id}
                templateId={template.id}
                name={template.name}
                slots={template.slots.map(
                  (slot) =>
                    `${slot.days
                      .split(",")
                      .map((day) => (t.weekdays as Record<string, string>)[day] ?? day)
                      .join(", ")} · ${formatTime(slot.start, locale)}–${formatTime(slot.end, locale)}`,
                )}
                assignments={children.map((child) => {
                  const starts = items
                    .filter((item) => item.template_id === template.id && item.person_id === child.id && item.tag === "school")
                    .map((item) => item.starts_on)
                    .filter((date): date is string => Boolean(date))
                    .sort();
                  return { person: child, startsOn: starts[0] ?? null };
                })}
              />
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
