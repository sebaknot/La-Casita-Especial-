"use client";

import { useMemo, useState } from "react";
import { ItemCard } from "@/components/ItemCard";
import {
  buildItemTree,
  TYPE_META,
  type Item,
  type ItemType,
} from "@/lib/types";

type Filter = "all" | Exclude<ItemType, "update">;

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "task", label: "Tasks" },
  { id: "note", label: "Notes" },
  { id: "deadline", label: "Deadlines" },
];

export function ItemList({
  items,
  emptyMessage,
  loanLabels,
}: {
  items: Item[];
  emptyMessage: string;
  /** loan id → borrower label, for items tied to a specific file. */
  loanLabels?: Record<string, string>;
}) {
  const [filter, setFilter] = useState<Filter>("all");

  const nodes = useMemo(() => buildItemTree(items), [items]);
  const visible = useMemo(
    () => nodes.filter((n) => filter === "all" || n.item.type === filter),
    [nodes, filter],
  );

  const active = visible.filter((n) => n.item.status !== "done");
  const done = visible.filter((n) => n.item.status === "done");

  return (
    <div className="space-y-4">
      <div
        className="flex flex-wrap gap-1.5"
        role="tablist"
        aria-label="Filter items"
      >
        {FILTERS.map(({ id, label }) => {
          const selected = filter === id;
          const accent =
            id === "all" ? "border-brass-soft text-brass" : TYPE_META[id].badge;
          return (
            <button
              key={id}
              role="tab"
              aria-selected={selected}
              onClick={() => setFilter(id)}
              className={`rounded-md border px-3 py-1 text-xs transition-colors ${
                selected
                  ? `${accent} bg-raised font-semibold`
                  : "border-hairline text-ink-dim hover:text-ink"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {active.length === 0 && done.length === 0 && (
        <p className="rounded-lg border border-dashed border-hairline px-4 py-8 text-center text-sm text-ink-faint">
          {emptyMessage}
        </p>
      )}

      <ul className="space-y-2">
        {active.map((node) => (
          <li key={node.item.id}>
            <ItemCard
              node={node}
              loanLabel={
                node.item.loan_id ? loanLabels?.[node.item.loan_id] : null
              }
            />
          </li>
        ))}
      </ul>

      {done.length > 0 && (
        <details className="group">
          <summary className="eyebrow cursor-pointer select-none list-none">
            Done · <span className="mono">{done.length}</span>
          </summary>
          <ul className="mt-2 space-y-2">
            {done.map((node) => (
              <li key={node.item.id}>
                <ItemCard
                  node={node}
                  loanLabel={
                    node.item.loan_id ? loanLabels?.[node.item.loan_id] : null
                  }
                />
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
