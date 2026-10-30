"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/I18nProvider";
import { useToast } from "@/components/Toast";
import { Icon } from "@/components/icons";
import { setRoutineDone } from "@/lib/actions";

/** A routine with today's check-off and its streak. */
export function RoutineCard({
  id,
  title,
  schedule,
  today,
  dueToday,
  doneToday,
  streak,
  nextLabel,
}: {
  id: string;
  title: string;
  schedule: string;
  today: string;
  dueToday: boolean;
  doneToday: boolean;
  streak: number;
  nextLabel: string | null;
}) {
  const { t } = useI18n();
  const { push } = useToast();
  const router = useRouter();
  const [done, setDone] = useState(doneToday);
  const [seen, setSeen] = useState(doneToday);
  const [pending, setPending] = useState(false);
  if (seen !== doneToday) {
    setSeen(doneToday);
    setDone(doneToday);
  }

  async function toggle() {
    const next = !done;
    setDone(next);
    setPending(true);
    const result = await setRoutineDone(id, today, next);
    setPending(false);
    if (!result.ok) {
      setDone(!next);
      push({ title: t.common.somethingWrong, description: result.error, variant: "danger" });
      return;
    }
    push({
      title: next ? t.pillar.routineDone(title) : t.pillar.routineUndone(title),
      variant: next ? "success" : "default",
      action: {
        label: t.common.undo,
        onClick: async () => {
          const undo = await setRoutineDone(id, today, !next);
          push(undo.ok ? { title: t.common.undone } : { title: t.command.undoFailed, variant: "danger" });
          router.refresh();
        },
      },
    });
    router.refresh();
  }

  const shownStreak = streak + (done && !doneToday ? 1 : 0) - (!done && doneToday ? 1 : 0);

  return (
    <li className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3">
      {dueToday ? (
        <button
          type="button"
          onClick={toggle}
          disabled={pending}
          aria-pressed={done}
          aria-label={done ? t.item.markOpen(title) : t.item.markDone(title)}
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 ${
            done ? "border-mint-ink bg-mint text-mint-ink" : "border-line-strong text-transparent hover:border-primary"
          }`}
        >
          <Icon name="check" className="h-6 w-6" />
        </button>
      ) : (
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-sunk text-ink-faint">
          <Icon name="repeat" className="h-5 w-5" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <Link href={`/item/${id}`} className="font-medium text-ink hover:text-primary-strong">
          {title}
        </Link>
        <p className="text-sm text-ink-dim">
          {schedule}
          {!dueToday && nextLabel ? ` · ${nextLabel}` : ""}
        </p>
      </div>
      {shownStreak > 0 && (
        <span className="shrink-0 rounded-full bg-mint-soft px-2.5 py-1 text-sm font-semibold text-mint-ink">
          {t.pillar.streak(shownStreak)}
        </span>
      )}
    </li>
  );
}
