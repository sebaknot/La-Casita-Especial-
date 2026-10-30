import Link from "next/link";
import { ProgressRing } from "@/components/ProgressRing";
import type { Dictionary } from "@/i18n";
import { formatDate, type LocaleTag } from "@/lib/dates";
import type { Item } from "@/lib/types";

/** Project summary. Next action is bold, like Sovereign's loan card. */
export function ProjectCard({
  project,
  steps,
  t,
  locale,
  children,
}: {
  project: Item;
  steps: { done: number; total: number };
  t: Dictionary;
  locale: LocaleTag;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex gap-3 rounded-xl border border-line bg-surface p-3">
      {steps.total > 0 && (
        <ProgressRing value={steps.done} max={steps.total} size={48} label={t.item.steps(steps.done, steps.total)} center={`${steps.done}/${steps.total}`} />
      )}
      <div className="min-w-0 flex-1">
        <Link href={`/item/${project.id}`} className="font-semibold text-ink hover:text-primary-strong">
          {project.title}
        </Link>
        {project.next_action && (
          <p className="mt-0.5 text-[0.95rem]">
            <span className="text-ink-dim">{t.item.nextAction}: </span>
            <strong className="text-ink">{project.next_action}</strong>
          </p>
        )}
        {project.waiting_on && <p className="mt-0.5 text-[0.95rem] text-warn-ink">{t.item.waitingOn(project.waiting_on)}</p>}
        {project.due_date && <p className="tabular mt-0.5 text-sm text-ink-dim">{t.item.due(formatDate(project.due_date, locale))}</p>}
        {children}
      </div>
    </div>
  );
}
