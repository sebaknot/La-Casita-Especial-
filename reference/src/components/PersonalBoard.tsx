"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { setItemSubgroup } from "@/lib/actions";
import { useToast } from "@/components/Toast";
import { ItemCard } from "@/components/ItemCard";
import { buildItemTree, type Item, type ItemNode, type Subgroup } from "@/lib/types";

/** Personal splits into Family and Goals, with an Unsorted catch-all. */
export function PersonalBoard({ items }: { items: Item[] }) {
  const nodes = useMemo(() => buildItemTree(items), [items]);
  const [assigned, setAssigned] = useState<Record<string, Subgroup>>({});

  const subgroupOf = (node: ItemNode): Subgroup | null =>
    assigned[node.item.id] ?? node.item.subgroup;

  const family = nodes.filter((node) => subgroupOf(node) === "family");
  const goals = nodes.filter((node) => subgroupOf(node) === "goals");
  const unsorted = nodes.filter((node) => subgroupOf(node) === null);

  return (
    <div className="space-y-8">
      <Section
        title="Family"
        nodes={family}
        emptyMessage="Nothing logged for family yet."
      />
      <Section
        title="Goals"
        nodes={goals}
        emptyMessage="No goals set. Name one and give it a target date."
        targetDates
      />

      {unsorted.length > 0 && (
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="eyebrow">Unsorted</h2>
            <span className="mono text-[11px] text-ink-faint">
              {unsorted.length}
            </span>
          </div>
          <ul className="space-y-2">
            {unsorted.map((node) => (
              <li key={node.item.id}>
                <ItemCard
                  node={node}
                  trailing={
                    <AssignButtons
                      itemId={node.item.id}
                      onAssigned={(subgroup) =>
                        setAssigned((current) => ({
                          ...current,
                          [node.item.id]: subgroup,
                        }))
                      }
                    />
                  }
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Section({
  title,
  nodes,
  emptyMessage,
  targetDates = false,
}: {
  title: string;
  nodes: ItemNode[];
  emptyMessage: string;
  targetDates?: boolean;
}) {
  const open = nodes.filter((node) => node.item.status !== "done");
  const done = nodes.filter((node) => node.item.status === "done");

  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="eyebrow">
          {title}
          {targetDates && (
            <span className="ml-2 font-normal normal-case tracking-normal text-ink-faint">
              target dates in mono
            </span>
          )}
        </h2>
        <span className="mono text-[11px] text-ink-faint">{open.length}</span>
      </div>

      {nodes.length === 0 ? (
        <p className="rounded-lg border border-dashed border-hairline px-4 py-6 text-center text-sm text-ink-faint">
          {emptyMessage}
        </p>
      ) : (
        <ul className="space-y-2">
          {open.map((node) => (
            <li key={node.item.id}>
              <ItemCard node={node} />
            </li>
          ))}
        </ul>
      )}

      {done.length > 0 && (
        <details className="mt-2">
          <summary className="eyebrow cursor-pointer select-none list-none">
            Done · <span className="mono">{done.length}</span>
          </summary>
          <ul className="mt-2 space-y-2">
            {done.map((node) => (
              <li key={node.item.id}>
                <ItemCard node={node} />
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function AssignButtons({
  itemId,
  onAssigned,
}: {
  itemId: string;
  onAssigned: (subgroup: Subgroup) => void;
}) {
  const router = useRouter();
  const { push } = useToast();

  async function assign(subgroup: Subgroup) {
    onAssigned(subgroup);
    const result = await setItemSubgroup(itemId, subgroup);
    if (result.ok) {
      push({ title: `Moved to ${subgroup}`, variant: "success" });
      router.refresh();
    } else {
      push({
        title: "Couldn't move item",
        description: result.error,
        variant: "danger",
      });
    }
  }

  return (
    <span className="ml-auto flex shrink-0 gap-1.5">
      {(["family", "goals"] as Subgroup[]).map((subgroup) => (
        <button
          key={subgroup}
          onClick={() => void assign(subgroup)}
          className="mono rounded border border-hairline px-2 py-0.5 text-[10px] capitalize text-ink-faint hover:border-brass-soft hover:text-brass"
        >
          → {subgroup}
        </button>
      ))}
    </span>
  );
}
