import { DOMAIN_META, TYPE_META, type Domain, type ItemType } from "@/lib/types";
import { formatDue, todayISO } from "@/lib/dates";

export function DomainBadge({ domain }: { domain: Domain | string }) {
  // Falls back to the raw value so an unrecognized domain (e.g. a row written
  // before a rename migration) degrades to a label instead of crashing.
  const short = DOMAIN_META[domain as Domain]?.short ?? domain;
  return (
    <span className="mono rounded border border-hairline bg-obsidian px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-ink-dim">
      {short}
    </span>
  );
}

/** Type identity badge — the same accent everywhere the type appears. */
export function TypeBadge({ type }: { type: ItemType }) {
  const meta = TYPE_META[type];
  return (
    <span
      className={`mono rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${meta.badge}`}
    >
      {meta.label}
    </span>
  );
}

export function PriorityDot({ priority }: { priority: 1 | 2 | 3 }) {
  const styles =
    priority === 1
      ? "bg-brass shadow-[0_0_6px_rgba(201,162,39,0.7)]"
      : priority === 2
        ? "bg-signal/80"
        : "bg-ink-faint";
  const label = priority === 1 ? "Critical" : priority === 2 ? "Normal" : "Low";
  return (
    <span
      title={label}
      aria-label={`Priority: ${label}`}
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${styles}`}
    />
  );
}

export function DueBadge({
  due,
  emphasis = false,
}: {
  due: string | null;
  /** Deadlines render their date bold, per the type identity. */
  emphasis?: boolean;
}) {
  if (!due) return null;
  const today = todayISO();
  const overdue = due < today;
  const isToday = due === today;
  return (
    <span
      className={`mono shrink-0 text-[11px] ${emphasis ? "font-bold" : ""} ${
        overdue
          ? "font-semibold text-danger"
          : isToday
            ? "font-semibold text-brass"
            : emphasis
              ? "text-ink"
              : "text-ink-dim"
      }`}
    >
      {overdue ? "OVERDUE · " : isToday ? "TODAY · " : ""}
      {formatDue(due)}
    </span>
  );
}

export function StateBadge({ state }: { state: "FL" | "GA" }) {
  return (
    <span
      className={`mono rounded border px-1.5 py-0.5 text-[10px] font-semibold ${
        state === "FL"
          ? "border-signal/50 text-signal"
          : "border-success/50 text-success"
      }`}
    >
      {state}
    </span>
  );
}

/** Brass chip marking an item that belongs to a specific loan file. */
export function LoanChip({ label }: { label: string }) {
  return (
    <span className="mono rounded border border-brass-soft/70 bg-brass/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-brass">
      {label}
    </span>
  );
}
