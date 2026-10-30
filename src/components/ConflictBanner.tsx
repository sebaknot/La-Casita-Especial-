import { Icon } from "@/components/icons";
import type { Dictionary } from "@/i18n";
import type { Conflict } from "@/lib/conflicts";
import { formatDate, formatTime, type LocaleTag } from "@/lib/dates";
import type { Person } from "@/lib/types";

export function ConflictBanner({
  conflicts,
  people,
  t,
  locale,
}: {
  conflicts: Conflict[];
  people: Person[];
  t: Dictionary;
  locale: LocaleTag;
}) {
  if (conflicts.length === 0) return null;
  const nameOf = (id: string) => people.find((person) => person.id === id)?.name ?? "—";

  return (
    <section aria-labelledby="conflicts-title" className="rounded-xl border border-warn-ink/25 bg-warn-soft px-4 py-3">
      <h2 id="conflicts-title" className="flex items-center gap-2 font-semibold text-warn-ink">
        <Icon name="alert" />
        {t.home.conflictsTitle}
      </h2>
      <ul className="mt-1.5 space-y-1 text-ink">
        {conflicts.map((conflict) => {
          const time = formatTime(conflict.a.start, locale);
          const where = (o: Conflict["a"]) => o.item.location ?? o.item.title;
          const text =
            conflict.kind === "driver"
              ? t.home.conflictDriver(nameOf(conflict.personId), where(conflict.a), where(conflict.b), time)
              : t.home.conflictPerson(nameOf(conflict.personId), where(conflict.a), where(conflict.b), time);
          return (
            <li key={`${conflict.a.key}-${conflict.b.key}`}>
              <span className="font-semibold">{formatDate(conflict.date, locale)}:</span> {text}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
