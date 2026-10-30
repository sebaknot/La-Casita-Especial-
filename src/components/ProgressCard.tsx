"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/I18nProvider";
import { useToast } from "@/components/Toast";
import { ProgressRing } from "@/components/ProgressRing";
import { setProgress } from "@/lib/actions";

/** Progress like Bible chapters: a ring and two big buttons. */
export function ProgressCard({ id, title, done, total }: { id: string; title: string; done: number; total: number }) {
  const { t } = useI18n();
  const { push } = useToast();
  const router = useRouter();
  const [value, setValue] = useState(done);
  const [seen, setSeen] = useState(done);
  const [pending, setPending] = useState(false);
  if (seen !== done) {
    setSeen(done);
    setValue(done);
  }

  async function bump(delta: number) {
    const previous = value;
    const next = Math.max(0, Math.min(total, value + delta));
    if (next === previous) return;
    setValue(next);
    setPending(true);
    const result = await setProgress(id, next);
    setPending(false);
    if (!result.ok) {
      setValue(previous);
      push({ title: t.common.somethingWrong, description: result.error, variant: "danger" });
      return;
    }
    push({
      title: t.pillar.progressSaved(next, total),
      variant: "success",
      action: {
        label: t.common.undo,
        onClick: async () => {
          const undo = await setProgress(id, previous);
          push(undo.ok ? { title: t.common.undone } : { title: t.command.undoFailed, variant: "danger" });
          router.refresh();
        },
      },
    });
    router.refresh();
  }

  return (
    <li className="flex items-center gap-4 rounded-xl border border-line bg-surface p-3">
      <ProgressRing value={value} max={total} size={64} label={t.item.progress(value, total)} />
      <div className="min-w-0 flex-1">
        <Link href={`/item/${id}`} className="font-medium text-ink hover:text-primary-strong">
          {title}
        </Link>
        <p className="tabular text-sm text-ink-dim">{t.item.progress(value, total)}</p>
      </div>
      <div className="flex gap-2">
        {[1, 5].map((delta) => (
          <button
            key={delta}
            type="button"
            disabled={pending || value >= total}
            onClick={() => bump(delta)}
            className="min-h-12 min-w-12 rounded-xl bg-primary-soft px-3 font-semibold text-primary-strong hover:bg-primary/15 disabled:opacity-50"
          >
            {delta === 1 ? t.pillar.plusOne : t.pillar.plusFive}
          </button>
        ))}
      </div>
    </li>
  );
}
