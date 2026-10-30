"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateScheduleLink } from "@/lib/actions";
import { useToast } from "@/components/Toast";
import type { AppSettings } from "@/lib/types";

/** External class-schedule link — editable in place, no code change needed. */
export function ScheduleLinkCard({ settings }: { settings: AppSettings | null }) {
  const router = useRouter();
  const { push } = useToast();
  const [editing, setEditing] = useState(false);
  const [url, setUrl] = useState(settings?.fastc_schedule_url ?? "");
  const [label, setLabel] = useState(settings?.fastc_schedule_label ?? "");
  const [pending, setPending] = useState(false);

  const currentUrl = settings?.fastc_schedule_url ?? null;
  const currentLabel = settings?.fastc_schedule_label || "Class Schedule";

  async function save(next?: { clear: boolean }) {
    if (pending) return;
    setPending(true);
    const result = await updateScheduleLink(
      next?.clear ? { url: null, label: null } : { url, label },
    );
    setPending(false);

    if (result.ok) {
      if (next?.clear) {
        setUrl("");
        setLabel("");
      }
      setEditing(false);
      push({
        title: next?.clear ? "Schedule link cleared" : "Schedule link saved",
        variant: "success",
      });
      router.refresh();
    } else {
      push({
        title: "Couldn't save link",
        description: result.error,
        variant: "danger",
      });
    }
  }

  if (editing) {
    return (
      <div className="space-y-2 rounded-lg border border-brass-soft/60 bg-surface p-4">
        <p className="eyebrow !text-brass">Schedule link</p>
        <label className="block">
          <span className="eyebrow">Label</span>
          <input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="FASTC Schedule"
            className="mt-1 w-full rounded-md border border-hairline bg-obsidian px-2 py-1.5 text-sm"
          />
        </label>
        <label className="block">
          <span className="eyebrow">URL</span>
          <input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://…"
            className="mono mt-1 w-full rounded-md border border-hairline bg-obsidian px-2 py-1.5 text-sm"
          />
        </label>
        <div className="flex flex-wrap justify-end gap-2 pt-1">
          {currentUrl && (
            <button
              onClick={() => void save({ clear: true })}
              disabled={pending}
              className="mr-auto rounded-md border border-hairline px-3 py-1.5 text-xs text-ink-faint hover:text-danger"
            >
              Remove link
            </button>
          )}
          <button
            onClick={() => setEditing(false)}
            className="rounded-md border border-hairline px-3 py-1.5 text-xs text-ink-dim hover:text-ink"
          >
            Cancel
          </button>
          <button
            onClick={() => void save()}
            disabled={pending}
            className="rounded-md border border-brass-soft bg-brass/10 px-4 py-1.5 text-xs font-semibold text-brass disabled:opacity-40"
          >
            Save
          </button>
        </div>
      </div>
    );
  }

  if (!currentUrl) {
    return (
      <div className="rounded-lg border border-dashed border-hairline px-5 py-6 text-center">
        <p className="text-sm text-ink-faint">
          No schedule linked yet. Point this at your FASTC class schedule.
        </p>
        <button
          onClick={() => setEditing(true)}
          className="mt-3 rounded-md border border-brass-soft bg-brass/10 px-4 py-1.5 text-xs font-semibold text-brass"
        >
          Add schedule link
        </button>
      </div>
    );
  }

  return (
    <div className="deck-hover flex items-center justify-between gap-3 rounded-lg border border-brass-soft/60 bg-surface px-5 py-4">
      <a
        href={currentUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="min-w-0 flex-1"
      >
        <p className="eyebrow !text-brass">Class Schedule</p>
        <p className="mt-1 truncate font-display text-xl font-semibold text-ink">
          {currentLabel} ↗
        </p>
        <p className="mono mt-0.5 truncate text-[11px] text-ink-faint">
          {currentUrl}
        </p>
      </a>
      <button
        onClick={() => setEditing(true)}
        className="shrink-0 text-[11px] text-ink-faint hover:text-ink"
      >
        Edit
      </button>
    </div>
  );
}
