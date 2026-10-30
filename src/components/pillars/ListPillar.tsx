import Link from "next/link";
import { EmptyState } from "@/components/EmptyState";
import { ItemRow } from "@/components/ItemRow";
import { ProgressCard } from "@/components/ProgressCard";
import { ProjectCard } from "@/components/ProjectCard";
import { RoutineCard } from "@/components/RoutineCard";
import { pillarConfig } from "@/config/pillars";
import { pillarName, tagLabel, type Dictionary } from "@/i18n";
import { describeSchedule } from "@/lib/describe";
import { addDays, formatDate, type LocaleTag } from "@/lib/dates";
import { expandOccurrences, nextDateOf, routineStreak, type Occurrence } from "@/lib/occurrences";
import { stepProgress, type Item, type RoutineCompletion } from "@/lib/types";

const UPCOMING_DAYS = 21;

function asOccurrence(item: Item, today: string): Occurrence {
  return { key: item.id, item, date: today, start: null, end: null, done: item.status === "done", overdue: false };
}

/**
 * The shared pillar layout: routines, progress, projects, lists, upcoming
 * events, records. Home Ops and Faith use it with real content; every other
 * pillar starts here as a ready, empty shell.
 */
export function ListPillar({
  pillarKey,
  items,
  completions,
  today,
  t,
  locale,
}: {
  pillarKey: string;
  items: Item[];
  completions: RoutineCompletion[];
  today: string;
  t: Dictionary;
  locale: LocaleTag;
}) {
  const top = items.filter((item) => item.parent_id === null);
  const routines = top.filter((item) => item.kind === "routine");
  const progress = top.filter((item) => item.progress_total && item.kind !== "routine" && item.kind !== "project");
  const projects = top.filter((item) => item.kind === "project" && item.status !== "done");
  const tasks = top.filter((item) => item.kind === "task" && !item.progress_total && item.status !== "done");
  const records = top.filter((item) => item.kind === "record");
  const upcoming = expandOccurrences(
    top.filter((item) => item.kind === "event"),
    [],
    today,
    addDays(today, UPCOMING_DAYS),
    today,
  );
  const routineToday = new Map(
    expandOccurrences(routines, completions, today, today, today).map((occurrence) => [occurrence.item.id, occurrence]),
  );

  const isEmpty = top.length === 0;
  const status = pillarConfig(pillarKey).status;

  // Lists group by label so groceries, cleaning etc. read as separate lists.
  const groups = new Map<string, Item[]>();
  for (const task of tasks) {
    const key = task.tag ?? "";
    groups.set(key, [...(groups.get(key) ?? []), task]);
  }

  return (
    <div className="space-y-6">
      {status === "shell" && <p className="rounded-xl bg-primary-soft px-3 py-2 text-ink">{t.pillar.shellNote}</p>}

      {isEmpty && (
        <EmptyState
          message={t.pillar.empty(pillarName(t, pillarKey))}
          actionLabel={t.pillar.addHere}
          href={`/add?pillar=${pillarKey}&back=/p/${pillarKey}`}
        />
      )}

      {routines.length > 0 && (
        <Section title={t.pillar.routines}>
          <ul className="grid gap-2 md:grid-cols-2">
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

      {progress.length > 0 && (
        <Section title={t.pillar.progress}>
          <ul className="grid gap-2 md:grid-cols-2">
            {progress.map((item) => (
              <ProgressCard key={item.id} id={item.id} title={item.title} done={item.progress_done ?? 0} total={item.progress_total!} />
            ))}
          </ul>
        </Section>
      )}

      {projects.length > 0 && (
        <Section title={t.pillar.projects}>
          <ul className="grid gap-2 md:grid-cols-2">
            {projects.map((project) => (
              <li key={project.id}>
                <ProjectCard project={project} steps={stepProgress(project.id, items)} t={t} locale={locale} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      {tasks.length > 0 && (
        <Section title={t.pillar.list}>
          <div className="grid gap-4 md:grid-cols-2">
            {[...groups.entries()].map(([tag, list]) => (
              <div key={tag || "untagged"}>
                {tag && <h3 className="eyebrow mb-1.5">{tagLabel(t, tag)}</h3>}
                <ul className="space-y-2">
                  {list.map((task) => (
                    <ItemRow key={task.id} occurrence={asOccurrence(task, today)} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Section>
      )}

      {upcoming.length > 0 && (
        <Section title={t.pillar.upcoming}>
          <ul className="grid gap-2 md:grid-cols-2">
            {upcoming.slice(0, 12).map((occurrence) => (
              <li key={occurrence.key} className="rounded-xl border border-line bg-surface px-3 py-2">
                <p className="text-sm font-semibold text-ink-dim">{formatDate(occurrence.date, locale)}</p>
                <Link href={`/item/${occurrence.item.id}`} className="font-medium text-ink hover:text-primary-strong">
                  {occurrence.item.title}
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {records.length > 0 && (
        <Section title={t.pillar.records} note={t.pillar.recordsNote}>
          <ul className="grid gap-2 md:grid-cols-2">
            {records.map((record) => (
              <li key={record.id} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-3 py-2.5">
                <Link href={`/item/${record.id}`} className="font-medium text-ink hover:text-primary-strong">
                  {record.title}
                </Link>
                <span className="rounded-full bg-sunk px-2.5 py-0.5 text-sm text-ink-dim">{t.statuses[record.status]}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

export function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-semibold">{title}</h2>
      {note && <p className="text-sm text-ink-dim">{note}</p>}
      <div className="mt-2">{children}</div>
    </section>
  );
}
