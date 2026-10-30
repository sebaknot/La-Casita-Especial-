import { swatch } from "@/config/palette";
import { Icon } from "@/components/icons";
import type { Person } from "@/lib/types";

/** A name with its color. The name is always shown — color is never the only signal. */
export function PersonChip({ person, size = "md" }: { person: Person | null; size?: "sm" | "md" }) {
  if (!person) return null;
  const colors = swatch(person.color);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm"}`}
      style={{ background: colors.soft, color: colors.ink }}
    >
      <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: colors.stroke }} />
      {person.name}
    </span>
  );
}

/** "Driving: Moni" — shown on pickups and drop-offs. */
export function DriverChip({ person, label }: { person: Person | null; label: string }) {
  if (!person) return null;
  const colors = swatch(person.color);
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm font-semibold"
      style={{ borderColor: colors.stroke, color: colors.ink, background: "var(--color-surface)" }}
    >
      <Icon name="car" className="h-4 w-4" />
      {label}
    </span>
  );
}

export function PersonDot({ person }: { person: Person | null }) {
  return (
    <span aria-hidden className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: swatch(person?.color).stroke }} />
  );
}
