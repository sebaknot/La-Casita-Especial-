import Link from "next/link";
import { notFound } from "next/navigation";
import { SensitiveZone } from "@/components/CommandBar";
import { ItemForm } from "@/components/ItemForm";
import { RecordLinks } from "@/components/RecordLinks";
import { StepList } from "@/components/StepList";
import { Icon } from "@/components/icons";
import { pillarConfig } from "@/config/pillars";
import { pillarName } from "@/i18n";
import { getItem, getRecordLinks, getSteps } from "@/lib/queries";
import { getT, requireHousehold } from "@/lib/session";

export default async function ItemPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, session, t] = await Promise.all([params, requireHousehold(), getT()]);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const item = await getItem(session.supabase, id);
  if (!item) notFound();

  const [steps, links] = await Promise.all([
    item.kind === "project" ? getSteps(session.supabase, item.id) : Promise.resolve([]),
    item.kind === "record" ? getRecordLinks(session.supabase, [item.id]) : Promise.resolve([]),
  ]);
  const back = item.parent_id ? `/item/${item.parent_id}` : `/p/${item.pillar_key}`;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <SensitiveZone active={pillarConfig(item.pillar_key).sensitive} />
      <Link href={back} className="inline-flex min-h-11 items-center gap-1 font-medium text-primary-strong">
        <Icon name="chevronLeft" className="h-4 w-4" />
        {pillarName(t, item.pillar_key)}
      </Link>

      {item.kind === "project" && <StepList project={item} steps={steps} />}
      {item.kind === "record" && <RecordLinks itemId={item.id} links={links} />}

      <section aria-labelledby="edit-title">
        <h1 id="edit-title" className="mb-4 text-2xl font-semibold tracking-tight">
          {t.form.editTitle}
        </h1>
        <ItemForm item={item} returnTo={back} />
      </section>
    </div>
  );
}
