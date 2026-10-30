import Link from "next/link";
import { EmptyState } from "@/components/EmptyState";
import { ItemRow } from "@/components/ItemRow";
import { Icon } from "@/components/icons";
import { Section } from "@/components/pillars/ListPillar";
import { WorkBoard } from "@/components/pillars/WorkBoard";
import type { Dictionary } from "@/i18n";
import { addDays, type LocaleTag } from "@/lib/dates";
import { expandOccurrences } from "@/lib/occurrences";
import { stepProgress, type Item } from "@/lib/types";

/** Work: real project tracking, entered by hand. Sensitive by default. */
export function WorkPillar({ items, today, t }: { items: Item[]; today: string; t: Dictionary; locale: LocaleTag }) {
  const projects = items.filter((item) => item.kind === "project" && item.parent_id === null);
  const steps = Object.fromEntries(projects.map((project) => [project.id, stepProgress(project.id, items)]));
  const tasks = items.filter((item) => item.kind === "task" && item.parent_id === null && item.status !== "done");
  const busy = expandOccurrences(
    items.filter((item) => item.kind === "event"),
    [],
    today,
    addDays(today, 6),
    today,
  );

  const addLink = (label: string, query: string) => (
    <Link
      href={`/add?pillar=work&${query}&back=/p/work`}
      className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-line bg-surface px-3 font-medium text-ink-dim hover:text-ink"
    >
      <Icon name="plus" className="h-4 w-4" />
      {label}
    </Link>
  );

  return (
    <div className="space-y-7">
      <Section title={t.work.board} note={t.work.dragHint}>
        <div className="mb-3 flex flex-wrap gap-2">{addLink(t.work.addProject, "kind=project")}</div>
        {projects.length === 0 ? <EmptyState message={t.work.noProjects} icon="briefcase" /> : <WorkBoard projects={projects} steps={steps} />}
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title={t.work.tasks}>
          <div className="mb-3">{addLink(t.work.addTask, "kind=task")}</div>
          {tasks.length === 0 ? (
            <EmptyState message={t.work.noTasks} />
          ) : (
            <ul className="space-y-2">
              {tasks.map((task) => (
                <ItemRow
                  key={task.id}
                  occurrence={{
                    key: task.id,
                    item: task,
                    date: task.due_date ?? today,
                    start: null,
                    end: null,
                    done: false,
                    overdue: Boolean(task.due_date && task.due_date < today),
                  }}
                />
              ))}
            </ul>
          )}
        </Section>

        <Section title={t.work.busy} note={t.work.busyNote}>
          <div className="mb-3">{addLink(t.work.addBusy, `kind=event&tag=busy&title=${encodeURIComponent(t.work.busyTitle)}`)}</div>
          {busy.length === 0 ? (
            <EmptyState message={t.work.noBusy} icon="clock" />
          ) : (
            <ul className="space-y-2">
              {busy.map((occurrence) => (
                <ItemRow key={occurrence.key} occurrence={occurrence} />
              ))}
            </ul>
          )}
        </Section>
      </div>
    </div>
  );
}
