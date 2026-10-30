import { HouseholdForm, InviteForm, PeopleEditor } from "@/components/SettingsForms";
import { LangToggle } from "@/components/LangToggle";
import { signOut } from "@/lib/actions";
import { getPeople } from "@/lib/queries";
import { getT, requireHousehold } from "@/lib/session";

export default async function SettingsPage() {
  const session = await requireHousehold();
  const t = await getT();
  const [people, invites, members] = await Promise.all([
    getPeople(session.supabase, session.household.id),
    session.supabase.from("household_invites").select("email").eq("household_id", session.household.id),
    session.supabase.from("household_members").select("user_id", { count: "exact", head: true }).eq("household_id", session.household.id),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight">{t.settings.title}</h1>

      <section aria-labelledby="people-title" className="space-y-3">
        <div>
          <h2 id="people-title" className="text-lg font-semibold">
            {t.settings.people}
          </h2>
          <p className="text-ink-dim">{t.settings.peopleNote}</p>
        </div>
        <PeopleEditor people={people} myPersonId={session.personId} />
      </section>

      <section aria-labelledby="household-title" className="space-y-3">
        <h2 id="household-title" className="text-lg font-semibold">
          {t.settings.household}
        </h2>
        <HouseholdForm name={session.household.name} schoolEventsUrl={session.household.school_events_url ?? ""} />
      </section>

      <section aria-labelledby="invite-title" className="space-y-3">
        <div>
          <h2 id="invite-title" className="text-lg font-semibold">
            {t.settings.invite}
          </h2>
          <p className="text-ink-dim">{t.settings.inviteNote}</p>
          <p className="mt-1 text-sm text-ink-dim">
            {t.settings.members}: <span className="tabular font-semibold">{members.count ?? 1}</span>
          </p>
        </div>
        <InviteForm pending={(invites.data ?? []).map((row) => row.email as string)} />
      </section>

      <section aria-labelledby="lang-title" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4">
        <h2 id="lang-title" className="text-lg font-semibold">
          {t.settings.language}
        </h2>
        <LangToggle />
      </section>

      <form action={signOut}>
        <button type="submit" className="min-h-12 rounded-xl border border-line bg-surface px-5 font-medium text-ink-dim hover:text-danger">
          {t.settings.signOut}
        </button>
      </form>
    </div>
  );
}
