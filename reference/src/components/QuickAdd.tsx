"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createItem } from "@/lib/actions";
import { useToast } from "@/components/Toast";
import {
  DOMAIN_META,
  PARENT_TYPES,
  type Domain,
  type ItemType,
  type Loan,
  type Subgroup,
} from "@/lib/types";

export function QuickAdd({
  domain,
  /** Personal splits new items into Family / Goals. */
  withSubgroup = false,
  defaultSubgroup = "family",
  /** Mortgages can optionally tie an item to a loan file. */
  loans,
}: {
  domain: Domain;
  withSubgroup?: boolean;
  defaultSubgroup?: Subgroup;
  loans?: Loan[];
}) {
  const router = useRouter();
  const { push } = useToast();
  const [title, setTitle] = useState("");
  const [type, setType] = useState<Exclude<ItemType, "update">>("task");
  const [priority, setPriority] = useState<1 | 2 | 3>(2);
  const [dueDate, setDueDate] = useState("");
  const [subgroup, setSubgroup] = useState<Subgroup>(defaultSubgroup);
  const [loanId, setLoanId] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim() || pending) return;
    setPending(true);

    const result = await createItem({
      domain,
      type,
      title,
      priority,
      due_date: dueDate || null,
      subgroup: withSubgroup ? subgroup : null,
      loan_id: loanId || null,
    });

    setPending(false);
    if (result.ok) {
      setTitle("");
      setDueDate("");
      setLoanId("");
      push({
        title: `Added ${type} to ${DOMAIN_META[domain].short}${
          withSubgroup ? ` · ${subgroup}` : ""
        }`,
        variant: "success",
      });
      router.refresh();
    } else {
      push({
        title: "Couldn't add item",
        description: result.error,
        variant: "danger",
      });
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-wrap items-center gap-2 rounded-lg border border-hairline bg-surface p-2"
    >
      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder={`Quick add to ${DOMAIN_META[domain].short}…`}
        aria-label="New item title"
        className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1.5 text-sm text-ink placeholder:text-ink-faint focus:border-hairline"
      />

      {withSubgroup && (
        <div className="flex overflow-hidden rounded-md border border-hairline">
          {(["family", "goals"] as Subgroup[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setSubgroup(option)}
              aria-pressed={subgroup === option}
              className={`px-2.5 py-1.5 text-xs capitalize transition-colors ${
                subgroup === option
                  ? "bg-brass/15 font-semibold text-brass"
                  : "text-ink-dim hover:text-ink"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      )}

      <select
        value={type}
        onChange={(event) =>
          setType(event.target.value as Exclude<ItemType, "update">)
        }
        aria-label="Item type"
        className="mono rounded-md border border-hairline bg-obsidian px-2 py-1.5 text-xs text-ink-dim"
      >
        {PARENT_TYPES.map((t) => (
          <option key={t.id} value={t.id}>
            {t.label}
          </option>
        ))}
      </select>

      <select
        value={priority}
        onChange={(event) =>
          setPriority(Number(event.target.value) as 1 | 2 | 3)
        }
        aria-label="Priority"
        className="mono rounded-md border border-hairline bg-obsidian px-2 py-1.5 text-xs text-ink-dim"
      >
        <option value={1}>P1 · Critical</option>
        <option value={2}>P2 · Normal</option>
        <option value={3}>P3 · Low</option>
      </select>

      {loans && loans.length > 0 && (
        <select
          value={loanId}
          onChange={(event) => setLoanId(event.target.value)}
          aria-label="Link to loan"
          className="mono max-w-[130px] rounded-md border border-hairline bg-obsidian px-2 py-1.5 text-xs text-ink-dim"
        >
          <option value="">No loan</option>
          {loans.map((loan) => (
            <option key={loan.id} value={loan.id}>
              {loan.borrower_label} ({loan.state})
            </option>
          ))}
        </select>
      )}

      <input
        type="date"
        value={dueDate}
        onChange={(event) => setDueDate(event.target.value)}
        aria-label={withSubgroup && subgroup === "goals" ? "Target date" : "Due date"}
        className="mono rounded-md border border-hairline bg-obsidian px-2 py-1 text-xs text-ink-dim"
      />

      <button
        type="submit"
        disabled={pending || !title.trim()}
        className="rounded-md border border-brass-soft bg-brass/10 px-3 py-1.5 text-xs font-semibold text-brass disabled:opacity-40"
      >
        Add
      </button>
    </form>
  );
}
