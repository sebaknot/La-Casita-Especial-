"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/I18nProvider";
import { useToast } from "@/components/Toast";
import { ProgressRing } from "@/components/ProgressRing";
import { Icon } from "@/components/icons";
import { addStep, setItemStatus } from "@/lib/actions";
import type { Item } from "@/lib/types";

/** A project's steps: check off in place, add more, watch the ring fill. */
export function StepList({ project, steps }: { project: Item; steps: Item[] }) {
  const { t } = useI18n();
  const { push } = useToast();
  const router = useRouter();
  const [local, setLocal] = useState(steps);
  const [seen, setSeen] = useState(steps);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  if (seen !== steps) {
    setSeen(steps);
    setLocal(steps);
  }

  const done = local.filter((step) => step.status === "done").length;

  async function toggle(step: Item) {
    const next = step.status === "done" ? "open" : "done";
    setLocal((current) => current.map((s) => (s.id === step.id ? { ...s, status: next } : s)));
    const result = await setItemStatus(step.id, next);
    if (!result.ok) {
      setLocal((current) => current.map((s) => (s.id === step.id ? { ...s, status: step.status } : s)));
      push({ title: t.common.somethingWrong, description: result.error, variant: "danger" });
      return;
    }
    push({
      title: next === "done" ? t.pillar.routineDone(step.title) : t.pillar.routineUndone(step.title),
      variant: next === "done" ? "success" : "default",
      action: {
        label: t.common.undo,
        onClick: async () => {
          await setItemStatus(step.id, step.status);
          push({ title: t.common.undone });
          router.refresh();
        },
      },
    });
    router.refresh();
  }

  async function add(event: React.FormEvent) {
    event.preventDefault();
    if (!draft.trim() || pending) return;
    setPending(true);
    const result = await addStep(project.id, draft);
    setPending(false);
    if (!result.ok) {
      push({ title: t.common.somethingWrong, description: result.error, variant: "danger" });
      return;
    }
    setDraft("");
    push({ title: t.itemPage.stepAdded, variant: "success" });
    router.refresh();
  }

  return (
    <section aria-labelledby="steps-title" className="rounded-2xl border border-line bg-surface p-4">
      <div className="mb-3 flex items-center gap-4">
        <ProgressRing value={done} max={Math.max(local.length, 1)} label={t.item.steps(done, local.length)} center={`${done}/${local.length}`} />
        <div>
          <h2 id="steps-title" className="text-xl font-semibold">
            {project.title}
          </h2>
          {project.next_action && (
            <p className="mt-0.5">
              <span className="text-ink-dim">{t.item.nextAction}: </span>
              <strong>{project.next_action}</strong>
            </p>
          )}
          {project.waiting_on && <p className="text-warn-ink">{t.item.waitingOn(project.waiting_on)}</p>}
        </div>
      </div>

      <h3 className="eyebrow mb-2">{t.itemPage.steps}</h3>
      {local.length === 0 ? (
        <p className="mb-3 text-ink-dim">{t.itemPage.noSteps}</p>
      ) : (
        <ul className="mb-3 space-y-1.5">
          {local.map((step) => {
            const isDone = step.status === "done";
            return (
              <li key={step.id} className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => toggle(step)}
                  aria-pressed={isDone}
                  aria-label={isDone ? t.item.markOpen(step.title) : t.item.markDone(step.title)}
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 ${
                    isDone ? "border-mint-ink bg-mint text-mint-ink" : "border-line-strong text-transparent hover:border-primary"
                  }`}
                >
                  <Icon name="check" className="h-5 w-5" />
                </button>
                <Link href={`/item/${step.id}`} className={`flex-1 ${isDone ? "text-ink-faint line-through" : "text-ink"}`}>
                  {step.title}
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <form onSubmit={add} className="flex gap-2">
        <label htmlFor="new-step" className="sr-only">
          {t.itemPage.addStep}
        </label>
        <input
          id="new-step"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={t.itemPage.stepPlaceholder}
          maxLength={200}
          className="min-h-12 flex-1 rounded-xl border border-line px-3"
        />
        <button type="submit" disabled={pending} className="min-h-12 rounded-xl bg-primary px-4 font-semibold text-white disabled:opacity-60">
          {t.common.add}
        </button>
      </form>
    </section>
  );
}
