"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateCpaSection } from "@/lib/actions";
import { useToast } from "@/components/Toast";
import { formatDue } from "@/lib/dates";
import {
  CPA_DISCIPLINES,
  CPA_STATUSES,
  type CpaSection,
  type CpaStatus,
} from "@/lib/types";

export function CpaTracker({ sections }: { sections: CpaSection[] }) {
  const [local, setLocal] = useState(sections);
  const passed = local.filter((section) => section.status === "passed").length;

  function applyLocal(section: string, patch: Partial<CpaSection>) {
    setLocal((current) =>
      current.map((entry) =>
        entry.section === section ? { ...entry, ...patch } : entry,
      ),
    );
  }

  return (
    <div className="space-y-4 rounded-lg border border-hairline bg-surface p-5">
      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <p className="eyebrow">Sections passed</p>
          <p className="mono text-sm">
            <span className={passed === 4 ? "text-brass" : "text-ink"}>
              {passed}
            </span>
            <span className="text-ink-faint">/4</span>
          </p>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-hairline">
          <div
            className="h-full rounded-full bg-brass transition-[width] duration-500"
            style={{ width: `${(passed / 4) * 100}%` }}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {local.map((section) => (
          <SectionCard
            key={section.section}
            section={section}
            onLocalChange={(patch) => applyLocal(section.section, patch)}
          />
        ))}
      </div>
    </div>
  );
}

function SectionCard({
  section,
  onLocalChange,
}: {
  section: CpaSection;
  onLocalChange: (patch: Partial<CpaSection>) => void;
}) {
  const router = useRouter();
  const { push } = useToast();
  const [celebrating, setCelebrating] = useState(false);
  const isDiscipline = section.section === "DISCIPLINE";
  const passed = section.status === "passed";

  async function save(patch: {
    status?: CpaStatus;
    exam_date?: string | null;
    score?: number | null;
    label?: string;
  }) {
    onLocalChange(patch as Partial<CpaSection>);

    if (patch.status === "passed" && !passed) {
      // Earned, not constant — one subtle flash on the card.
      setCelebrating(true);
      window.setTimeout(() => setCelebrating(false), 1000);
    }

    const result = await updateCpaSection(section.section, patch);
    if (!result.ok) {
      push({
        title: "Update failed",
        description: result.error,
        variant: "danger",
      });
      return;
    }
    if (patch.status === "passed") {
      push({ title: `${section.label} passed.`, variant: "success" });
    }
    router.refresh();
  }

  return (
    <div
      className={`rounded-lg border p-3 transition-colors ${celebrating ? "celebrate" : ""} ${
        passed ? "border-brass-soft bg-brass/10" : "border-hairline bg-obsidian/40"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        {isDiscipline ? (
          <select
            value={section.label}
            onChange={(event) => void save({ label: event.target.value })}
            aria-label="Discipline section"
            className={`mono rounded border border-hairline bg-obsidian px-1.5 py-0.5 text-sm font-bold ${
              passed ? "text-brass" : "text-ink"
            }`}
          >
            <option value="Discipline">Discipline</option>
            {CPA_DISCIPLINES.map((discipline) => (
              <option key={discipline} value={discipline}>
                {discipline}
              </option>
            ))}
          </select>
        ) : (
          <span
            className={`mono text-lg font-bold ${passed ? "text-brass" : "text-ink"}`}
          >
            {section.label}
          </span>
        )}
        {passed && section.score !== null && (
          <span className="mono text-sm font-bold text-brass">
            {section.score}
          </span>
        )}
      </div>

      <select
        value={section.status}
        onChange={(event) => void save({ status: event.target.value as CpaStatus })}
        aria-label={`${section.label} status`}
        className="mono mt-2 w-full rounded-md border border-hairline bg-obsidian px-2 py-1 text-xs text-ink-dim"
      >
        {CPA_STATUSES.map((status) => (
          <option key={status.id} value={status.id}>
            {status.label}
          </option>
        ))}
      </select>

      <label className="mt-2 block">
        <span className="eyebrow">Exam date</span>
        <input
          type="date"
          value={section.exam_date ?? ""}
          onChange={(event) => void save({ exam_date: event.target.value || null })}
          className="mono mt-0.5 w-full rounded-md border border-hairline bg-obsidian px-2 py-1 text-xs text-ink-dim"
        />
      </label>

      <label className="mt-2 block">
        <span className="eyebrow">Score</span>
        <input
          type="number"
          min={0}
          max={99}
          value={section.score ?? ""}
          placeholder="—"
          onChange={(event) =>
            void save({
              score: event.target.value === "" ? null : Number(event.target.value),
            })
          }
          className="mono mt-0.5 w-full rounded-md border border-hairline bg-obsidian px-2 py-1 text-xs text-ink-dim"
        />
      </label>

      {section.exam_date && !passed && (
        <p className="mono mt-2 text-[10px] text-ink-faint">
          Scheduled {formatDue(section.exam_date)}
        </p>
      )}
    </div>
  );
}
