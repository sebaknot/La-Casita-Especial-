"use client";

import { useRouter } from "next/navigation";
import { KanbanBoard } from "@/components/KanbanBoard";
import { ProjectCard } from "@/components/ProjectCard";
import { useI18n } from "@/components/I18nProvider";
import { setItemStatus } from "@/lib/actions";
import type { Item, ItemStatus } from "@/lib/types";

const COLUMNS: Exclude<ItemStatus, "archived">[] = ["open", "in_progress", "waiting", "done"];

export function WorkBoard({ projects, steps }: { projects: Item[]; steps: Record<string, { done: number; total: number }> }) {
  const { t, tag } = useI18n();
  const router = useRouter();

  return (
    <KanbanBoard
      columns={COLUMNS.map((id) => ({ id, label: t.statuses[id] }))}
      items={projects}
      columnOf={(project) => (project.status === "archived" ? "done" : project.status) as (typeof COLUMNS)[number]}
      onMove={async (project, to) => {
        const result = await setItemStatus(project.id, to);
        router.refresh();
        return result.ok ? null : result.error;
      }}
      renderCard={(project) => (
        <ProjectCard project={project} steps={steps[project.id] ?? { done: 0, total: 0 }} t={t} locale={tag} />
      )}
      moveLabel={t.work.moveTo}
      messages={{
        moved: (project, column) => t.work.moved(project.title, column.label),
        failed: t.common.somethingWrong,
        undo: t.common.undo,
        undone: t.common.undone,
      }}
    />
  );
}
