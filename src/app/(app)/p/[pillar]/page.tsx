import { notFound } from "next/navigation";
import { SensitiveZone } from "@/components/CommandBar";
import { KidsPillar } from "@/components/pillars/KidsPillar";
import { ListPillar } from "@/components/pillars/ListPillar";
import { PillarHeader } from "@/components/pillars/PillarHeader";
import { WorkPillar } from "@/components/pillars/WorkPillar";
import { isPillarKey, PILLARS } from "@/config/pillars";
import { localeTag, pillarName } from "@/i18n";
import { todayISO } from "@/lib/dates";
import { getCompletions, getItems, getPeople, getTemplates } from "@/lib/queries";
import { getLocale, getT, householdTZ, requireHousehold } from "@/lib/session";

export async function generateMetadata({ params }: { params: Promise<{ pillar: string }> }) {
  const [{ pillar }, t] = await Promise.all([params, getT()]);
  return { title: pillarName(t, pillar) };
}

/** One route for every pillar; PILLARS[key].view picks the layout. */
export default async function PillarPage({ params }: { params: Promise<{ pillar: string }> }) {
  const { pillar } = await params;
  if (!isPillarKey(pillar)) notFound();

  const session = await requireHousehold();
  const [t, locale] = await Promise.all([getT(), getLocale()]);
  const tag = localeTag(locale);
  const today = todayISO(householdTZ(session.household));
  const config = PILLARS[pillar];

  const items = await getItems(session.supabase, session.household.id, pillar);
  const completions = await getCompletions(
    session.supabase,
    items.filter((item) => item.kind === "routine").map((item) => item.id),
    today,
  );

  let body: React.ReactNode;
  switch (config.view) {
    case "kids": {
      const [people, templates] = await Promise.all([
        getPeople(session.supabase, session.household.id),
        getTemplates(session.supabase, session.household.id),
      ]);
      body = (
        <KidsPillar
          household={session.household}
          items={items}
          people={people}
          completions={completions}
          templates={templates.filter((template) => template.pillar_key === pillar)}
          today={today}
          t={t}
          locale={tag}
        />
      );
      break;
    }
    case "work":
      body = <WorkPillar items={items} today={today} t={t} locale={tag} />;
      break;
    case "list":
      body = <ListPillar pillarKey={pillar} items={items} completions={completions} today={today} t={t} locale={tag} />;
      break;
  }

  return (
    <div className="space-y-6">
      <SensitiveZone active={config.sensitive} />
      <PillarHeader pillarKey={pillar} t={t} />
      {body}
    </div>
  );
}
