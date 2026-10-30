"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { restoreItemStatus, setItemStatus } from "@/lib/actions";
import { useToast } from "@/components/Toast";
import { DomainBadge, DueBadge, PriorityDot } from "@/components/badges";
import { TYPE_META, type Item } from "@/lib/types";

/** Top items across all domains — priority first, then due date. */
export function TodayBoard({ items }: { items: Item[] }) {
  const router = useRouter();
  const { push } = useToast();
  const [local, setLocal] = useState(items);
  const [prevItems, setPrevItems] = useState(items);
  if (prevItems !== items) {
    setPrevItems(items);
    setLocal(items);
  }

  async function complete(item: Item) {
    setLocal((current) => current.filter((i) => i.id !== item.id));

    const result = await setItemStatus(item.id, "done");
    if (!result.ok) {
      setLocal(items);
      push({ title: "Update failed", description: result.error, variant: "danger" });
      return;
    }

    push({
      title: `Completed “${item.title}”`,
      variant: "success",
      action: {
        label: "Undo",
        onClick: async () => {
          await restoreItemStatus(item.id, item.status);
          router.refresh();
        },
      },
    });
    router.refresh();
  }

  if (local.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-hairline px-4 py-8 text-center text-sm text-ink-faint">
        The board is clear. The empire runs itself today.
      </p>
    );
  }

  return (
    <ul className="space-y-1.5">
      {local.slice(0, 12).map((item) => (
        <li
          key={item.id}
          className={`deck-hover flex items-center gap-3 rounded-lg border border-l-2 border-hairline bg-surface px-3 py-2 ${TYPE_META[item.type].border}`}
        >
          <button
            onClick={() => void complete(item)}
            aria-label={`Complete ${item.title}`}
            className="h-4.5 w-4.5 shrink-0 rounded-full border border-ink-faint transition-colors hover:border-success hover:bg-success/20"
          />
          <PriorityDot priority={item.priority} />
          <DomainBadge domain={item.domain} />
          <span
            className={`mono hidden shrink-0 rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-wide sm:inline ${TYPE_META[item.type].badge}`}
          >
            {TYPE_META[item.type].label}
          </span>
          <p className="min-w-0 flex-1 truncate text-sm text-ink">{item.title}</p>
          <DueBadge due={item.due_date} emphasis={item.type === "deadline"} />
        </li>
      ))}
    </ul>
  );
}
