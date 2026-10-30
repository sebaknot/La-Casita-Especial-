import Link from "next/link";
import { swatch } from "@/config/palette";
import type { Person } from "@/lib/types";

/** Who's-this-for chips. Plain links so it works before JS loads. */
export function PersonFilter({
  people,
  selected,
  basePath,
  allLabel,
  label,
}: {
  people: Person[];
  selected: string | null;
  basePath: string;
  allLabel: string;
  label: string;
}) {
  return (
    <nav aria-label={label} className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      <Link
        href={basePath}
        aria-current={!selected ? "true" : undefined}
        className={`inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 font-medium ${
          !selected ? "border-primary bg-primary text-white" : "border-line bg-surface text-ink-dim"
        }`}
      >
        {allLabel}
      </Link>
      {people.map((person) => {
        const active = selected === person.id;
        const colors = swatch(person.color);
        return (
          <Link
            key={person.id}
            href={`${basePath}?who=${person.id}`}
            aria-current={active ? "true" : undefined}
            className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 font-medium"
            style={
              active
                ? { background: colors.stroke, borderColor: colors.stroke, color: "#fff" }
                : { background: colors.soft, borderColor: "transparent", color: colors.ink }
            }
          >
            <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: active ? "#fff" : colors.stroke }} />
            {person.name}
          </Link>
        );
      })}
    </nav>
  );
}
