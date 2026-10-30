"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/I18nProvider";
import { useToast } from "@/components/Toast";
import { PersonChip } from "@/components/PersonChip";
import { applyTemplate } from "@/lib/actions";
import { formatDate } from "@/lib/dates";
import type { Person } from "@/lib/types";

/** The school schedule: built once, applied per child with her own start date. */
export function TemplateCard({
  templateId,
  name,
  slots,
  assignments,
}: {
  templateId: string;
  name: string;
  slots: string[];
  assignments: { person: Person; startsOn: string | null }[];
}) {
  const { t, tag } = useI18n();
  const { push } = useToast();
  const router = useRouter();
  const [dates, setDates] = useState<Record<string, string>>(
    Object.fromEntries(assignments.map((a) => [a.person.id, a.startsOn ?? ""])),
  );
  const [pending, setPending] = useState<string | null>(null);

  async function apply(person: Person) {
    const date = dates[person.id];
    setPending(person.id);
    const result = await applyTemplate(templateId, person.id, date);
    setPending(null);
    if (!result.ok) {
      push({ title: t.common.somethingWrong, description: result.error, variant: "danger" });
      return;
    }
    push({ title: t.kids.applied(person.name, formatDate(date, tag, { month: "long", day: "numeric" })), variant: "success" });
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <h3 className="text-lg font-semibold">{name}</h3>
      <ul className="mt-1 text-ink-dim">
        {slots.map((slot) => (
          <li key={slot}>{slot}</li>
        ))}
      </ul>
      <p className="mt-2 text-sm text-ink-dim">{t.kids.templateNote}</p>
      <ul className="mt-3 space-y-3">
        {assignments.map(({ person, startsOn }) => (
          <li key={person.id} className="flex flex-wrap items-end gap-3">
            <div className="min-w-28">
              <PersonChip person={person} />
              <p className="mt-1 text-sm text-ink-dim">
                {startsOn ? t.kids.appliedFrom(formatDate(startsOn, tag, { month: "short", day: "numeric", year: "numeric" })) : t.kids.notApplied}
              </p>
            </div>
            <div>
              <label htmlFor={`start-${person.id}`} className="mb-1 block text-sm font-medium">
                {t.kids.startDate}
              </label>
              <input
                id={`start-${person.id}`}
                type="date"
                value={dates[person.id] ?? ""}
                onChange={(event) => setDates({ ...dates, [person.id]: event.target.value })}
                className="min-h-11 rounded-xl border border-line px-3"
              />
            </div>
            <button
              type="button"
              disabled={!dates[person.id] || pending === person.id || dates[person.id] === startsOn}
              onClick={() => apply(person)}
              className="min-h-11 rounded-xl bg-primary-soft px-4 font-semibold text-primary-strong hover:bg-primary/15 disabled:opacity-50"
            >
              {startsOn ? t.kids.apply : t.kids.applyTo(person.name)}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
