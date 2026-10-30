"use client";

import { useState } from "react";
import { useToast } from "@/components/Toast";

/*
 * Generic kanban, adapted from Sovereign's mortgage pipeline: HTML5 drag and
 * drop between columns, a select on every card as the touch/keyboard
 * fallback, optimistic moves with rollback, and an undo toast.
 */

export interface KanbanColumn<K extends string> {
  id: K;
  label: string;
}

export function KanbanBoard<T extends { id: string }, K extends string>({
  columns,
  items,
  columnOf,
  onMove,
  renderCard,
  moveLabel,
  messages,
  emptyLabel = "—",
}: {
  columns: KanbanColumn<K>[];
  items: T[];
  columnOf: (item: T) => K;
  /** Persist a move. Return an error string to roll back. */
  onMove: (item: T, to: K) => Promise<string | null>;
  renderCard: (item: T) => React.ReactNode;
  moveLabel: string;
  messages: { moved: (item: T, to: KanbanColumn<K>) => string; failed: string; undo: string; undone: string };
  emptyLabel?: string;
}) {
  const { push } = useToast();
  const [overrides, setOverrides] = useState<Record<string, K>>({});
  const [seen, setSeen] = useState(items);
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<K | null>(null);
  if (seen !== items) {
    setSeen(items);
    setOverrides({});
  }

  const current = (item: T) => overrides[item.id] ?? columnOf(item);

  async function move(item: T, to: K) {
    const from = current(item);
    if (from === to) return;
    setOverrides((o) => ({ ...o, [item.id]: to }));
    const error = await onMove(item, to);
    if (error) {
      setOverrides((o) => ({ ...o, [item.id]: from }));
      push({ title: messages.failed, description: error, variant: "danger" });
      return;
    }
    push({
      title: messages.moved(item, columns.find((c) => c.id === to)!),
      variant: "success",
      action: {
        label: messages.undo,
        onClick: async () => {
          setOverrides((o) => ({ ...o, [item.id]: from }));
          const undoError = await onMove(item, from);
          push(undoError ? { title: messages.failed, variant: "danger" } : { title: messages.undone });
        },
      },
    });
  }

  return (
    <div className="pb-2">
      {/* Stacked on phones (no sideways scrolling), side by side from tablet up. */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {columns.map((column) => {
          const cards = items.filter((item) => current(item) === column.id);
          return (
            <section
              key={column.id}
              aria-label={column.label}
              onDragOver={(event) => {
                event.preventDefault();
                setOver(column.id);
              }}
              onDragLeave={() => setOver(null)}
              onDrop={(event) => {
                event.preventDefault();
                setOver(null);
                const id = event.dataTransfer.getData("text/item-id") || dragId;
                const item = items.find((candidate) => candidate.id === id);
                if (item) void move(item, column.id);
                setDragId(null);
              }}
              className={`min-w-0 rounded-2xl border p-2.5 transition-colors ${
                over === column.id ? "border-primary bg-primary-soft" : "border-line bg-sunk/60"
              }`}
            >
              <header className="mb-2 flex items-center justify-between px-1">
                <h3 className="font-semibold">{column.label}</h3>
                <span className="tabular text-sm text-ink-faint">{cards.length}</span>
              </header>
              <ul className="space-y-2">
                {cards.map((item) => (
                  <li
                    key={item.id}
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.setData("text/item-id", item.id);
                      event.dataTransfer.effectAllowed = "move";
                      setDragId(item.id);
                    }}
                    className="cursor-grab active:cursor-grabbing"
                  >
                    {renderCard(item)}
                    <label className="mt-1 flex items-center gap-2 px-1 text-sm text-ink-dim">
                      <span>{moveLabel}</span>
                      <select
                        value={current(item)}
                        onChange={(event) => void move(item, event.target.value as K)}
                        className="min-h-11 flex-1 rounded-lg border border-line bg-surface px-2"
                      >
                        {columns.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </li>
                ))}
                {cards.length === 0 && <li className="px-1 pb-1 text-ink-faint">{emptyLabel}</li>}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
