"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/I18nProvider";
import { useToast } from "@/components/Toast";
import { PALETTE, PALETTE_KEYS, swatch } from "@/config/palette";
import { invitePartner, saveHousehold, savePerson, setMyPerson } from "@/lib/actions";
import { RELATIONS, type Person } from "@/lib/types";

const field = "min-h-12 w-full rounded-xl border border-line bg-surface px-3";

export function PeopleEditor({ people, myPersonId }: { people: Person[]; myPersonId: string | null }) {
  return (
    <ul className="space-y-3">
      {people.map((person) => (
        <PersonRow key={person.id} person={person} isMe={person.id === myPersonId} />
      ))}
      <PersonRow key="new" person={null} isMe={false} />
    </ul>
  );
}

function PersonRow({ person, isMe }: { person: Person | null; isMe: boolean }) {
  const { t } = useI18n();
  const { push } = useToast();
  const router = useRouter();
  const [name, setName] = useState(person?.name ?? "");
  const [color, setColor] = useState<string>(person?.color ?? "green");
  const [relation, setRelation] = useState<string>(person?.relation ?? "relative");
  const [birthday, setBirthday] = useState(person?.birthday ?? "");
  const [pending, setPending] = useState(false);
  const idBase = person?.id ?? "new";

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    const result = await savePerson({ id: person?.id, name, color, relation, birthday: birthday || null });
    setPending(false);
    if (!result.ok) {
      push({ title: t.common.somethingWrong, description: result.error, variant: "danger" });
      return;
    }
    push({ title: person ? t.settings.personSaved(name) : t.settings.personAdded(name), variant: "success" });
    if (!person) {
      setName("");
      setBirthday("");
    }
    router.refresh();
  }

  async function claim() {
    if (!person) return;
    const result = await setMyPerson(person.id);
    push(result.ok ? { title: t.settings.meSet(person.name), variant: "success" } : { title: t.common.somethingWrong, variant: "danger" });
    router.refresh();
  }

  return (
    <li className="rounded-2xl border border-line bg-surface p-4" style={{ borderLeft: `5px solid ${swatch(color).stroke}` }}>
      <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`name-${idBase}`} className="mb-1 block font-medium">
            {person ? t.settings.name : t.settings.addPerson}
          </label>
          <input id={`name-${idBase}`} value={name} onChange={(e) => setName(e.target.value)} maxLength={40} required className={field} />
        </div>
        <div>
          <label htmlFor={`relation-${idBase}`} className="mb-1 block font-medium">
            {t.settings.relation}
          </label>
          <select id={`relation-${idBase}`} value={relation} onChange={(e) => setRelation(e.target.value)} className={field}>
            {RELATIONS.map((option) => (
              <option key={option} value={option}>
                {t.relations[option]}
              </option>
            ))}
          </select>
        </div>
        <fieldset className="sm:col-span-2">
          <legend className="mb-1 font-medium">{t.settings.color}</legend>
          <div className="flex flex-wrap gap-2">
            {PALETTE_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                aria-pressed={color === key}
                aria-label={key}
                onClick={() => setColor(key)}
                className="h-11 w-11 rounded-full border-4"
                style={{ background: PALETTE[key].stroke, borderColor: color === key ? "var(--color-ink)" : "transparent" }}
              />
            ))}
          </div>
        </fieldset>
        <div>
          <label htmlFor={`birthday-${idBase}`} className="mb-1 block font-medium">
            {t.settings.birthday} <span className="font-normal text-ink-faint">({t.common.optional})</span>
          </label>
          <input id={`birthday-${idBase}`} type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} className={field} />
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <button type="submit" disabled={pending || !name.trim()} className="min-h-12 rounded-xl bg-primary px-5 font-semibold text-white disabled:opacity-60">
            {person ? t.common.save : t.common.add}
          </button>
          {person &&
            (isMe ? (
              <span className="inline-flex min-h-12 items-center rounded-xl bg-mint-soft px-3 font-medium text-mint-ink">{t.settings.me} ✓</span>
            ) : (
              <button type="button" onClick={claim} className="min-h-12 rounded-xl border border-line px-3 font-medium text-ink-dim">
                {t.settings.me}
              </button>
            ))}
        </div>
      </form>
    </li>
  );
}

export function HouseholdForm({ name: initialName, schoolEventsUrl }: { name: string; schoolEventsUrl: string }) {
  const { t } = useI18n();
  const { push } = useToast();
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [url, setUrl] = useState(schoolEventsUrl);
  const [pending, setPending] = useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    const result = await saveHousehold({ name, school_events_url: url });
    setPending(false);
    push(result.ok ? { title: t.settings.householdSaved, variant: "success" } : { title: t.common.somethingWrong, description: result.error, variant: "danger" });
    router.refresh();
  }

  return (
    <form onSubmit={save} className="grid gap-3 rounded-2xl border border-line bg-surface p-4 sm:grid-cols-2">
      <div>
        <label htmlFor="household-name" className="mb-1 block font-medium">
          {t.settings.householdName}
        </label>
        <input id="household-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className={field} />
      </div>
      <div>
        <label htmlFor="school-url" className="mb-1 block font-medium">
          {t.settings.schoolEventsUrl}
        </label>
        <input id="school-url" type="url" placeholder="https://" value={url} onChange={(e) => setUrl(e.target.value)} className={field} />
      </div>
      <div>
        <button type="submit" disabled={pending} className="min-h-12 rounded-xl bg-primary px-5 font-semibold text-white disabled:opacity-60">
          {pending ? t.common.saving : t.common.save}
        </button>
      </div>
    </form>
  );
}

export function InviteForm({ pending: pendingInvites }: { pending: string[] }) {
  const { t } = useI18n();
  const { push } = useToast();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    const result = await invitePartner(email);
    setPending(false);
    if (!result.ok) {
      push({ title: t.common.somethingWrong, description: result.error, variant: "danger" });
      return;
    }
    push({ title: t.settings.inviteSent(email.trim().toLowerCase()), variant: "success" });
    setEmail("");
    router.refresh();
  }

  return (
    <div className="space-y-3 rounded-2xl border border-line bg-surface p-4">
      <form onSubmit={send} className="flex flex-wrap items-end gap-2">
        <div className="min-w-60 flex-1">
          <label htmlFor="invite-email" className="mb-1 block font-medium">
            {t.settings.inviteEmail}
          </label>
          <input id="invite-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
        </div>
        <button type="submit" disabled={pending} className="min-h-12 rounded-xl bg-primary px-5 font-semibold text-white disabled:opacity-60">
          {t.common.add}
        </button>
      </form>
      {pendingInvites.length > 0 && (
        <div>
          <h3 className="eyebrow mb-1">{t.settings.pending}</h3>
          <ul className="text-ink-dim">
            {pendingInvites.map((invite) => (
              <li key={invite}>{invite}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
