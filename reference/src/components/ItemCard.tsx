"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  addUpdate,
  restoreItemStatus,
  setItemStatus,
  updateItem,
} from "@/lib/actions";
import { useToast } from "@/components/Toast";
import { DueBadge, LoanChip, PriorityDot, TypeBadge } from "@/components/badges";
import { timeAgo } from "@/lib/dates";
import { TYPE_META, type Item, type ItemNode, type ItemStatus } from "@/lib/types";

/**
 * One task/note/deadline, with its update thread nested underneath.
 * Updates never stand alone — they hang off the parent on a brass rail.
 */
export function ItemCard({
  node,
  loanLabel,
  trailing,
}: {
  node: ItemNode;
  /** Borrower label when the item is tied to a specific loan file. */
  loanLabel?: string | null;
  /** Extra controls rendered in the card footer (e.g. subgroup assignment). */
  trailing?: React.ReactNode;
}) {
  const router = useRouter();
  const { push } = useToast();
  const { item } = node;

  const [status, setStatus] = useState<ItemStatus>(item.status);
  const [updates, setUpdates] = useState<Item[]>(node.updates);
  const [expanded, setExpanded] = useState(false);
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);

  const meta = TYPE_META[item.type];
  const done = status === "done";

  async function changeStatus(next: ItemStatus) {
    const prev = status;
    setStatus(next);

    const result = await setItemStatus(item.id, next);
    if (!result.ok) {
      setStatus(prev);
      push({
        title: "Update failed",
        description: result.error,
        variant: "danger",
      });
      return;
    }

    if (next === "done") {
      push({
        title: `Completed “${item.title}”`,
        variant: "success",
        action: {
          label: "Undo",
          onClick: async () => {
            await restoreItemStatus(item.id, prev);
            setStatus(prev);
            router.refresh();
          },
        },
      });
    } else if (next === "archived") {
      push({ title: `Archived “${item.title}”` });
    } else {
      push({ title: `Reopened “${item.title}”` });
    }
    router.refresh();
  }

  async function submitUpdate() {
    const text = draft.trim();
    if (!text || pending) return;
    setPending(true);

    const result = await addUpdate(item.id, text);
    setPending(false);

    if (!result.ok) {
      push({
        title: "Couldn't add update",
        description: result.error,
        variant: "danger",
      });
      return;
    }

    if (result.data) setUpdates((current) => [...current, result.data!]);
    setDraft("");
    setComposing(false);
    push({ title: "Update added", variant: "success" });
    router.refresh();
  }

  if (editing) {
    return (
      <EditCard
        item={item}
        onCancel={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          router.refresh();
        }}
      />
    );
  }

  // Collapsed by default except the most recent entry.
  const visibleUpdates = expanded ? updates : updates.slice(-1);
  const hiddenCount = updates.length - visibleUpdates.length;

  return (
    <div
      className={`deck-hover group rounded-lg border border-l-2 border-hairline bg-surface ${meta.border} ${
        item.type === "note" ? "bg-obsidian/40" : ""
      } ${done ? "opacity-60" : ""}`}
    >
      <div className="flex items-start gap-3 px-3 py-2.5">
        <button
          onClick={() => void changeStatus(done ? "open" : "done")}
          aria-label={done ? `Reopen ${item.title}` : `Complete ${item.title}`}
          className={`mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full border transition-colors ${
            done
              ? "border-success bg-success/20 text-[9px] text-success"
              : "border-ink-faint hover:border-success hover:bg-success/20"
          }`}
        >
          {done ? "✓" : ""}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <PriorityDot priority={item.priority} />
            <TypeBadge type={item.type} />
            <DueBadge due={item.due_date} emphasis={item.type === "deadline"} />
            {loanLabel && <LoanChip label={loanLabel} />}
          </div>
          <p
            className={`mt-1 text-sm text-ink ${done ? "line-through" : ""}`}
          >
            {item.title}
          </p>
          {item.details && (
            <p className="mt-0.5 text-sm text-ink-dim">{item.details}</p>
          )}
        </div>

        <div className="flex shrink-0 gap-2 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
          <button
            onClick={() => setEditing(true)}
            className="text-[11px] text-ink-faint hover:text-ink"
          >
            Edit
          </button>
          <button
            onClick={() => void changeStatus("archived")}
            className="text-[11px] text-ink-faint hover:text-ink"
          >
            Archive
          </button>
        </div>
      </div>

      {/* Update thread — brass rail, newest last */}
      {updates.length > 0 && (
        <div className="px-3 pb-1">
          {hiddenCount > 0 && (
            <button
              onClick={() => setExpanded(true)}
              className="mono mb-1.5 ml-6 text-[11px] text-brass hover:underline"
            >
              {hiddenCount} earlier update{hiddenCount === 1 ? "" : "s"} ▾
            </button>
          )}
          {expanded && updates.length > 1 && (
            <button
              onClick={() => setExpanded(false)}
              className="mono mb-1.5 ml-6 text-[11px] text-ink-faint hover:text-ink"
            >
              Collapse ▴
            </button>
          )}
          <ol className="ml-6 space-y-2 border-l border-brass/40 pl-3">
            {visibleUpdates.map((update) => (
              <li key={update.id} className="relative">
                <span className="absolute -left-[17px] top-1.5 h-1.5 w-1.5 rounded-full bg-brass" />
                <p className="mono text-[10px] uppercase tracking-wide text-ink-faint">
                  {timeAgo(update.created_at)} ago
                </p>
                <p className="text-sm leading-snug text-ink-dim">
                  {update.title}
                </p>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Add update — inline, no modal */}
      <div className="flex items-center gap-2 px-3 pb-2 pt-1">
        {composing ? (
          <input
            autoFocus
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void submitUpdate();
              }
              if (event.key === "Escape") {
                setComposing(false);
                setDraft("");
              }
            }}
            onBlur={() => {
              if (!draft.trim()) setComposing(false);
            }}
            disabled={pending}
            placeholder="What happened? Enter to log it."
            aria-label={`Add an update to ${item.title}`}
            className="ml-6 w-full rounded-md border border-brass-soft/60 bg-obsidian px-2 py-1 text-sm text-ink placeholder:text-ink-faint disabled:opacity-50"
          />
        ) : (
          <button
            onClick={() => setComposing(true)}
            className="mono ml-6 text-[11px] text-ink-faint transition-colors hover:text-brass"
          >
            + Add update
          </button>
        )}
        {trailing}
      </div>
    </div>
  );
}

function EditCard({
  item,
  onCancel,
  onSaved,
}: {
  item: Item;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const { push } = useToast();
  const [title, setTitle] = useState(item.title);
  const [details, setDetails] = useState(item.details ?? "");
  const [priority, setPriority] = useState<1 | 2 | 3>(item.priority);
  const [dueDate, setDueDate] = useState(item.due_date ?? "");
  const [pending, setPending] = useState(false);

  async function save() {
    if (!title.trim() || pending) return;
    setPending(true);
    const result = await updateItem(item.id, {
      title: title.trim(),
      details: details.trim() || null,
      priority,
      due_date: dueDate || null,
    });
    setPending(false);
    if (result.ok) {
      push({ title: "Saved", variant: "success" });
      onSaved();
    } else {
      push({
        title: "Save failed",
        description: result.error,
        variant: "danger",
      });
    }
  }

  return (
    <div className="space-y-2 rounded-lg border border-brass-soft/50 bg-surface p-3">
      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        aria-label="Title"
        className="w-full rounded-md border border-hairline bg-obsidian px-2 py-1.5 text-sm text-ink"
      />
      <textarea
        value={details}
        onChange={(event) => setDetails(event.target.value)}
        aria-label="Details"
        placeholder="Details…"
        rows={2}
        className="w-full rounded-md border border-hairline bg-obsidian px-2 py-1.5 text-sm text-ink placeholder:text-ink-faint"
      />
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={priority}
          onChange={(event) =>
            setPriority(Number(event.target.value) as 1 | 2 | 3)
          }
          aria-label="Priority"
          className="mono rounded-md border border-hairline bg-obsidian px-2 py-1 text-xs text-ink-dim"
        >
          <option value={1}>P1 · Critical</option>
          <option value={2}>P2 · Normal</option>
          <option value={3}>P3 · Low</option>
        </select>
        <input
          type="date"
          value={dueDate}
          onChange={(event) => setDueDate(event.target.value)}
          aria-label="Due date"
          className="mono rounded-md border border-hairline bg-obsidian px-2 py-1 text-xs text-ink-dim"
        />
        <div className="ml-auto flex gap-2">
          <button
            onClick={onCancel}
            className="rounded-md border border-hairline px-3 py-1 text-xs text-ink-dim hover:text-ink"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={pending}
            className="rounded-md border border-brass-soft bg-brass/10 px-3 py-1 text-xs font-semibold text-brass disabled:opacity-40"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
