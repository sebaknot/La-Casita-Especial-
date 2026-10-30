"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/I18nProvider";
import { useHousehold } from "@/components/HouseholdProvider";
import { useToast } from "@/components/Toast";
import { DriverChip, PersonChip } from "@/components/PersonChip";
import { Icon } from "@/components/icons";
import { swatch } from "@/config/palette";
import { tagLabel } from "@/i18n";
import { setItemStatus, setRoutineDone } from "@/lib/actions";
import { formatTime } from "@/lib/dates";
import type { Occurrence } from "@/lib/occurrences";
import { isRide } from "@/lib/types";

/**
 * One line of a schedule. Tasks and routines check off in place
 * (optimistic, with an undo toast); everything opens its detail page.
 */
export function ItemRow({ occurrence, compact = false }: { occurrence: Occurrence; compact?: boolean }) {
  const { t, tag: locale } = useI18n();
  const { personById } = useHousehold();
  const { push } = useToast();
  const router = useRouter();
  const { item, date, start, end, overdue } = occurrence;

  const [done, setDone] = useState(occurrence.done);
  const [pending, setPending] = useState(false);
  const [seen, setSeen] = useState(occurrence.done);
  if (seen !== occurrence.done) {
    setSeen(occurrence.done);
    setDone(occurrence.done);
  }

  const person = personById(item.person_id);
  const driver = personById(item.responsible_person_id);
  const colors = swatch(person?.color);
  const checkable = item.kind === "task" || item.kind === "routine";

  async function apply(next: boolean): Promise<boolean> {
    const result =
      item.kind === "routine"
        ? await setRoutineDone(item.id, date, next)
        : await setItemStatus(item.id, next ? "done" : "open");
    if (!result.ok) {
      push({ title: t.common.somethingWrong, description: result.error, variant: "danger" });
      return false;
    }
    return true;
  }

  async function toggle() {
    if (pending) return;
    const next = !done;
    setDone(next);
    setPending(true);
    const ok = await apply(next);
    setPending(false);
    if (!ok) {
      setDone(!next);
      return;
    }
    push({
      title: next ? t.pillar.routineDone(item.title) : t.pillar.routineUndone(item.title),
      variant: next ? "success" : "default",
      action: {
        label: t.common.undo,
        onClick: async () => {
          setDone(!next);
          if (await apply(!next)) push({ title: t.common.undone });
          else setDone(next);
          router.refresh();
        },
      },
    });
    router.refresh();
  }

  const time = start ? `${formatTime(start, locale)}${end ? `–${formatTime(end, locale)}` : ""}` : null;
  const label = item.tag && !isRide(item.tag) ? tagLabel(t, item.tag) : null;
  // "School" at "School" says it twice — drop the label when it repeats the place.
  const tagText = label && label.toLowerCase() !== item.location?.toLowerCase() ? label : null;

  return (
    <li
      className={`flex items-start gap-3 rounded-xl border border-line bg-surface py-2.5 pr-3 pl-3 ${done ? "opacity-70" : ""}`}
      style={{ borderLeft: `5px solid ${colors.stroke}` }}
    >
      {checkable ? (
        <button
          type="button"
          onClick={toggle}
          disabled={pending}
          aria-pressed={done}
          aria-label={done ? t.item.markOpen(item.title) : t.item.markDone(item.title)}
          className={`-my-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
            done ? "border-mint-ink bg-mint text-mint-ink" : "border-line-strong bg-surface text-transparent hover:border-primary"
          }`}
        >
          <Icon name="check" className="h-5 w-5" />
        </button>
      ) : (
        <span className="flex h-10 w-11 shrink-0 items-center justify-center text-ink-faint">
          <Icon name={isRide(item.tag) ? "car" : item.kind === "project" ? "folder" : "clock"} className="h-5 w-5" />
        </span>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          {time && <span className="tabular text-sm font-semibold text-ink-dim">{time}</span>}
          {overdue && (
            <span className="rounded-full bg-warn-soft px-2 py-0.5 text-xs font-semibold text-warn-ink">{t.home.overdue}</span>
          )}
        </div>
        <Link
          href={`/item/${item.id}`}
          className={`block font-medium leading-snug text-ink hover:text-primary-strong ${done ? "line-through decoration-ink-faint" : ""}`}
        >
          {item.title}
        </Link>
        {!compact && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-sm text-ink-dim">
            <PersonChip person={person} size="sm" />
            {isRide(item.tag) && driver && <DriverChip person={driver} label={t.item.driving(driver.name)} />}
            {item.location && (
              <span className="inline-flex items-center gap-1">
                <Icon name="pin" className="h-3.5 w-3.5" />
                {item.location}
              </span>
            )}
            {tagText && <span className="rounded-full bg-sunk px-2 py-0.5 text-xs">{tagText}</span>}
            {item.recurrence && (
              <span className="inline-flex items-center text-ink-faint" title={t.item.every}>
                <Icon name="repeat" className="h-3.5 w-3.5" />
                <span className="sr-only">{t.item.every}</span>
              </span>
            )}
          </div>
        )}
        {compact && (person || (isRide(item.tag) && driver)) && (
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <PersonChip person={person} size="sm" />
            {isRide(item.tag) && driver && <DriverChip person={driver} label={t.item.driving(driver.name)} />}
          </div>
        )}
      </div>
    </li>
  );
}
