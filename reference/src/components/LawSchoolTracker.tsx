"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateLawSchool } from "@/lib/actions";
import { useToast } from "@/components/Toast";
import { daysUntil, formatDue } from "@/lib/dates";
import {
  LAW_SCHOOL_MILESTONES,
  type LawSchoolMilestone,
  type LawSchoolPrep,
} from "@/lib/types";

export function LawSchoolTracker({ prep }: { prep: LawSchoolPrep }) {
  const router = useRouter();
  const { push } = useToast();
  const [state, setState] = useState(prep);
  const [editingDate, setEditingDate] = useState(false);
  const [lsatDate, setLsatDate] = useState(prep.lsat_date ?? "");

  const daysLeft = state.lsat_date ? daysUntil(state.lsat_date) : null;
  const completed = LAW_SCHOOL_MILESTONES.filter(
    (milestone) => state[milestone.key],
  ).length;

  async function toggle(key: LawSchoolMilestone) {
    const value = !state[key];
    setState((current) => ({ ...current, [key]: value }));

    const result = await updateLawSchool({ milestone: { key, value } });
    if (!result.ok) {
      setState((current) => ({ ...current, [key]: !value }));
      push({
        title: "Update failed",
        description: result.error,
        variant: "danger",
      });
      return;
    }
    router.refresh();
  }

  async function saveDate() {
    setEditingDate(false);
    setState((current) => ({ ...current, lsat_date: lsatDate || null }));
    const result = await updateLawSchool({ lsat_date: lsatDate || null });
    if (result.ok) {
      push({ title: "LSAT date updated", variant: "success" });
      router.refresh();
    } else {
      push({
        title: "Update failed",
        description: result.error,
        variant: "danger",
      });
    }
  }

  return (
    <div className="space-y-4 rounded-lg border border-hairline bg-surface p-5">
      {/* LSAT countdown */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">LSAT test date</p>
          {editingDate ? (
            <div className="mt-1 flex items-center gap-2">
              <input
                type="date"
                value={lsatDate}
                onChange={(event) => setLsatDate(event.target.value)}
                className="mono rounded-md border border-hairline bg-obsidian px-2 py-1.5 text-sm"
              />
              <button
                onClick={() => void saveDate()}
                className="rounded-md border border-brass-soft bg-brass/10 px-3 py-1.5 text-xs font-semibold text-brass"
              >
                Save
              </button>
            </div>
          ) : (
            <button onClick={() => setEditingDate(true)} className="mt-1 block text-left">
              <span className="mono text-2xl font-bold text-ink">
                {state.lsat_date ? formatDue(state.lsat_date) : "Set a date"}
              </span>
              <span className="ml-2 text-xs text-ink-faint underline">edit</span>
            </button>
          )}
        </div>

        {daysLeft !== null && (
          <p className="mono text-sm">
            {daysLeft >= 0 ? (
              <>
                <span
                  className={`text-3xl font-bold ${daysLeft <= 30 ? "text-brass" : "text-ink"}`}
                >
                  {daysLeft}
                </span>{" "}
                <span className="text-ink-dim">days out</span>
              </>
            ) : (
              <span className="text-ink-dim">
                Test day was {Math.abs(daysLeft)} days ago
              </span>
            )}
          </p>
        )}
      </div>

      {/* Application milestone stepper */}
      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <p className="eyebrow">Application milestones</p>
          <p className="mono text-[11px] text-ink-dim">
            {completed}/{LAW_SCHOOL_MILESTONES.length}
          </p>
        </div>

        <ol className="-mx-1 flex gap-0 overflow-x-auto pb-1">
          {LAW_SCHOOL_MILESTONES.map((milestone, index) => {
            const isDone = Boolean(state[milestone.key]);
            return (
              <li key={milestone.key} className="flex min-w-max items-center">
                <button
                  onClick={() => void toggle(milestone.key)}
                  aria-pressed={isDone}
                  className="group mx-1 flex flex-col items-center gap-1.5 px-1"
                >
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full border text-[10px] transition-colors ${
                      isDone
                        ? "border-brass bg-brass/20 text-brass"
                        : "border-hairline text-ink-faint group-hover:border-brass-soft"
                    }`}
                  >
                    {isDone ? "✓" : index + 1}
                  </span>
                  <span
                    className={`max-w-[92px] text-center text-[10px] leading-tight ${
                      isDone ? "text-brass" : "text-ink-faint"
                    }`}
                  >
                    {milestone.label}
                  </span>
                </button>
                {index < LAW_SCHOOL_MILESTONES.length - 1 && (
                  <span
                    aria-hidden
                    className={`mb-4 h-px w-6 ${isDone ? "bg-brass/50" : "bg-hairline"}`}
                  />
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
