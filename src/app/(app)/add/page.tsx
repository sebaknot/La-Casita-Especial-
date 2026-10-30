import { ItemForm } from "@/components/ItemForm";
import { isPillarKey } from "@/config/pillars";
import { isISODate } from "@/lib/dates";
import { getT } from "@/lib/session";
import { isItemKind } from "@/lib/types";

/** Quick Add — reachable from the + tab, empty states and pillar pages (prefilled by query string). */
export default async function AddPage({
  searchParams,
}: {
  searchParams: Promise<{ pillar?: string; kind?: string; date?: string; who?: string; tag?: string; title?: string; parent?: string; back?: string }>;
}) {
  const [t, params] = await Promise.all([getT(), searchParams]);
  const back = params.back?.startsWith("/") && !params.back.startsWith("//") ? params.back : "/";

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">{t.form.newTitle}</h1>
      <ItemForm
        returnTo={back}
        defaults={{
          pillar_key: isPillarKey(params.pillar) ? params.pillar : undefined,
          kind: isItemKind(params.kind) ? params.kind : undefined,
          date: isISODate(params.date) ? params.date : undefined,
          person_id: params.who,
          tag: params.tag,
          title: params.title?.slice(0, 200),
          parent_id: params.parent,
        }}
      />
    </div>
  );
}
