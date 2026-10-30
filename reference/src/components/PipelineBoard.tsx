"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createLoan, updateLoan } from "@/lib/actions";
import { useToast } from "@/components/Toast";
import { StateBadge } from "@/components/badges";
import { formatDue } from "@/lib/dates";
import { LOAN_STAGES, type Loan, type LoanStage } from "@/lib/types";

const BOARD_STAGES = LOAN_STAGES.filter((stage) => stage.id !== "dead");

export function PipelineBoard({
  loans,
  itemCounts,
}: {
  loans: Loan[];
  /** loan id → number of open items linked to that file. */
  itemCounts?: Record<string, number>;
}) {
  const router = useRouter();
  const { push } = useToast();
  const [local, setLocal] = useState(loans);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<LoanStage | null>(null);
  const [editing, setEditing] = useState<Loan | null>(null);
  const [adding, setAdding] = useState(false);
  const [prevLoans, setPrevLoans] = useState(loans);
  if (prevLoans !== loans) {
    setPrevLoans(loans);
    setLocal(loans);
  }

  async function moveLoan(id: string, stage: LoanStage) {
    const loan = local.find((l) => l.id === id);
    if (!loan || loan.stage === stage) return;
    const prevStage = loan.stage;

    setLocal((current) =>
      current.map((l) => (l.id === id ? { ...l, stage } : l)),
    );

    const result = await updateLoan(id, { stage });
    if (!result.ok) {
      setLocal((current) =>
        current.map((l) => (l.id === id ? { ...l, stage: prevStage } : l)),
      );
      push({ title: "Move failed", description: result.error, variant: "danger" });
      return;
    }

    const label = LOAN_STAGES.find((s) => s.id === stage)?.label ?? stage;
    push({
      title: `${loan.borrower_label} → ${label}`,
      variant: "success",
      action: {
        label: "Undo",
        onClick: async () => {
          await updateLoan(id, { stage: prevStage }, { silent: true });
          router.refresh();
        },
      },
    });
    router.refresh();
  }

  const deadLoans = local.filter((loan) => loan.stage === "dead");

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setAdding(true)}
          className="rounded-md border border-brass-soft bg-brass/10 px-3 py-1.5 text-xs font-semibold text-brass"
        >
          + New loan
        </button>
      </div>

      {/* Horizontal pipeline */}
      <div className="-mx-4 overflow-x-auto px-4 pb-2 md:-mx-6 md:px-6">
        <div className="flex min-w-max gap-3">
          {BOARD_STAGES.map((stage) => {
            const stageLoans = local.filter((loan) => loan.stage === stage.id);
            const isOver = overStage === stage.id;
            return (
              <section
                key={stage.id}
                aria-label={stage.label}
                onDragOver={(event) => {
                  event.preventDefault();
                  setOverStage(stage.id);
                }}
                onDragLeave={() => setOverStage(null)}
                onDrop={(event) => {
                  event.preventDefault();
                  setOverStage(null);
                  const id = event.dataTransfer.getData("text/loan-id") || dragId;
                  if (id) void moveLoan(id, stage.id);
                  setDragId(null);
                }}
                className={`w-56 shrink-0 rounded-lg border p-2 transition-colors ${
                  isOver
                    ? "border-brass bg-brass/5"
                    : "border-hairline bg-surface/60"
                }`}
              >
                <header className="mb-2 flex items-center justify-between px-1">
                  <h3 className="eyebrow">{stage.label}</h3>
                  <span className="mono text-[11px] text-ink-faint">
                    {stageLoans.length}
                  </span>
                </header>
                <div className="space-y-2">
                  {stageLoans.map((loan) => (
                    <LoanCard
                      key={loan.id}
                      loan={loan}
                      itemCount={itemCounts?.[loan.id] ?? 0}
                      onDragStart={() => setDragId(loan.id)}
                      onEdit={() => setEditing(loan)}
                      onMove={(target) => void moveLoan(loan.id, target)}
                    />
                  ))}
                  {stageLoans.length === 0 && (
                    <p className="px-1 py-3 text-center text-[11px] text-ink-faint">
                      —
                    </p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      {/* Dead bucket, collapsed */}
      <details
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          const id = event.dataTransfer.getData("text/loan-id") || dragId;
          if (id) void moveLoan(id, "dead");
          setDragId(null);
        }}
      >
        <summary className="eyebrow cursor-pointer select-none list-none">
          Dead · <span className="mono">{deadLoans.length}</span>
          <span className="ml-2 font-normal normal-case tracking-normal text-ink-faint">
            (drop here to kill a deal)
          </span>
        </summary>
        <div className="mt-2 flex flex-wrap gap-2">
          {deadLoans.map((loan) => (
            <div
              key={loan.id}
              className="flex items-center gap-2 rounded-md border border-hairline px-3 py-1.5 opacity-60"
            >
              <span className="mono text-xs">{loan.borrower_label}</span>
              <StateBadge state={loan.state} />
              <button
                onClick={() => void moveLoan(loan.id, "lead")}
                className="text-[11px] text-ink-faint hover:text-ink"
              >
                Revive
              </button>
            </div>
          ))}
        </div>
      </details>

      {(adding || editing) && (
        <LoanDialog
          loan={editing}
          onClose={() => {
            setAdding(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function LoanCard({
  loan,
  itemCount,
  onDragStart,
  onEdit,
  onMove,
}: {
  loan: Loan;
  itemCount: number;
  onDragStart: () => void;
  onEdit: () => void;
  onMove: (stage: LoanStage) => void;
}) {
  return (
    <article
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData("text/loan-id", loan.id);
        event.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      className="deck-hover cursor-grab rounded-md border border-hairline bg-raised p-2.5 active:cursor-grabbing"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="mono text-sm font-semibold text-ink">
          {loan.borrower_label}
        </span>
        <StateBadge state={loan.state} />
      </div>
      <div className="mono mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-ink-dim">
        {loan.loan_type && <span>{loan.loan_type}</span>}
        {loan.target_close && <span>close {formatDue(loan.target_close)}</span>}
        {itemCount > 0 && (
          <span className="rounded border border-brass-soft/70 bg-brass/10 px-1 text-[10px] text-brass">
            {itemCount} item{itemCount === 1 ? "" : "s"}
          </span>
        )}
      </div>
      {loan.next_action && (
        <p className="mt-1.5 text-xs font-bold text-ink">{loan.next_action}</p>
      )}
      <div className="mt-2 flex items-center justify-between gap-2">
        {/* Keyboard / touch fallback for drag-and-drop */}
        <select
          value={loan.stage}
          onChange={(event) => onMove(event.target.value as LoanStage)}
          aria-label={`Stage for ${loan.borrower_label}`}
          className="mono max-w-[120px] rounded border border-hairline bg-obsidian px-1 py-0.5 text-[10px] text-ink-faint"
        >
          {LOAN_STAGES.map((stage) => (
            <option key={stage.id} value={stage.id}>
              {stage.label}
            </option>
          ))}
        </select>
        <button
          onClick={onEdit}
          className="text-[11px] text-ink-faint hover:text-ink"
        >
          Edit
        </button>
      </div>
    </article>
  );
}

function LoanDialog({
  loan,
  onClose,
}: {
  loan: Loan | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const { push } = useToast();
  const [borrower, setBorrower] = useState(loan?.borrower_label ?? "");
  const [state, setState] = useState<"FL" | "GA">(loan?.state ?? "FL");
  const [loanType, setLoanType] = useState(loan?.loan_type ?? "");
  const [targetClose, setTargetClose] = useState(loan?.target_close ?? "");
  const [nextAction, setNextAction] = useState(loan?.next_action ?? "");
  const [notes, setNotes] = useState(loan?.notes ?? "");
  const [pending, setPending] = useState(false);

  async function save() {
    if (!borrower.trim() || pending) return;
    setPending(true);

    const payload = {
      borrower_label: borrower,
      state,
      loan_type: loanType || null,
      target_close: targetClose || null,
      next_action: nextAction || null,
      notes: notes || null,
    };

    const result = loan
      ? await updateLoan(loan.id, payload)
      : await createLoan(payload);

    setPending(false);
    if (result.ok) {
      push({
        title: loan ? `Updated ${borrower}` : `Added loan ${borrower}`,
        variant: "success",
      });
      router.refresh();
      onClose();
    } else {
      push({ title: "Save failed", description: result.error, variant: "danger" });
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label={loan ? "Edit loan" : "New loan"}
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-md space-y-3 rounded-lg border border-hairline bg-surface p-5"
      >
        <h2 className="font-display text-xl font-semibold">
          {loan ? `Edit ${loan.borrower_label}` : "New loan"}
        </h2>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="eyebrow">Borrower label</span>
            <input
              value={borrower}
              onChange={(event) => setBorrower(event.target.value)}
              placeholder="R.G."
              className="mono mt-1 w-full rounded-md border border-hairline bg-obsidian px-2 py-1.5 text-sm"
            />
          </label>
          <label className="block">
            <span className="eyebrow">State</span>
            <select
              value={state}
              onChange={(event) => setState(event.target.value as "FL" | "GA")}
              className="mono mt-1 w-full rounded-md border border-hairline bg-obsidian px-2 py-1.5 text-sm"
            >
              <option value="FL">FL</option>
              <option value="GA">GA</option>
            </select>
          </label>
          <label className="block">
            <span className="eyebrow">Loan type</span>
            <input
              value={loanType}
              onChange={(event) => setLoanType(event.target.value)}
              placeholder="Conventional / FHA / VA"
              className="mt-1 w-full rounded-md border border-hairline bg-obsidian px-2 py-1.5 text-sm"
            />
          </label>
          <label className="block">
            <span className="eyebrow">Target close</span>
            <input
              type="date"
              value={targetClose}
              onChange={(event) => setTargetClose(event.target.value)}
              className="mono mt-1 w-full rounded-md border border-hairline bg-obsidian px-2 py-1.5 text-sm"
            />
          </label>
        </div>

        <label className="block">
          <span className="eyebrow">Next action</span>
          <input
            value={nextAction}
            onChange={(event) => setNextAction(event.target.value)}
            placeholder="The single most important next step"
            className="mt-1 w-full rounded-md border border-hairline bg-obsidian px-2 py-1.5 text-sm"
          />
        </label>

        <label className="block">
          <span className="eyebrow">Notes</span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={2}
            className="mt-1 w-full rounded-md border border-hairline bg-obsidian px-2 py-1.5 text-sm"
          />
        </label>

        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onClose}
            className="rounded-md border border-hairline px-3 py-1.5 text-xs text-ink-dim hover:text-ink"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={pending || !borrower.trim()}
            className="rounded-md border border-brass-soft bg-brass/10 px-4 py-1.5 text-xs font-semibold text-brass disabled:opacity-40"
          >
            {loan ? "Save" : "Add loan"}
          </button>
        </div>
      </div>
    </div>
  );
}
