"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/I18nProvider";
import { useHousehold } from "@/components/HouseholdProvider";
import { useToast } from "@/components/Toast";
import { swatch } from "@/config/palette";
import { updateItem } from "@/lib/actions";

/** Who's driving this ride — changes it every week (it's a recurring item). */
export function DriverSelect({ itemId, title, driverId }: { itemId: string; title: string; driverId: string | null }) {
  const { t } = useI18n();
  const { people, personById } = useHousehold();
  const { push } = useToast();
  const router = useRouter();
  const [value, setValue] = useState(driverId ?? "");
  const [seen, setSeen] = useState(driverId);
  const [pending, setPending] = useState(false);
  if (seen !== driverId) {
    setSeen(driverId);
    setValue(driverId ?? "");
  }
  const colors = swatch(personById(value)?.color);

  async function change(next: string) {
    const previous = value;
    setValue(next);
    setPending(true);
    const result = await updateItem(itemId, { responsible_person_id: next || null });
    setPending(false);
    if (!result.ok) {
      setValue(previous);
      push({ title: t.common.somethingWrong, description: result.error, variant: "danger" });
      return;
    }
    push({
      title: t.kids.driverChanged(title, personById(next)?.name ?? t.common.none),
      variant: "success",
      action: {
        label: t.common.undo,
        onClick: async () => {
          const undo = await updateItem(itemId, { responsible_person_id: previous || null });
          push(undo.ok ? { title: t.common.undone } : { title: t.command.undoFailed, variant: "danger" });
          router.refresh();
        },
      },
    });
    router.refresh();
  }

  return (
    <select
      aria-label={`${t.form.driver} — ${title}`}
      value={value}
      disabled={pending}
      onChange={(event) => change(event.target.value)}
      className="min-h-11 rounded-full border-2 bg-surface px-3 font-semibold"
      style={{ borderColor: colors.stroke, color: colors.ink }}
    >
      <option value="">{t.common.none}</option>
      {people.map((person) => (
        <option key={person.id} value={person.id}>
          🚗 {person.name}
        </option>
      ))}
    </select>
  );
}
