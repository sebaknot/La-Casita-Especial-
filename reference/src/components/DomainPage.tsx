import { getDomainItems } from "@/lib/queries";
import { DOMAIN_META, type Domain } from "@/lib/types";
import { QuickAdd } from "@/components/QuickAdd";
import { ItemList } from "@/components/ItemList";

export async function DomainPage({
  domain,
  emptyMessage,
  children,
}: {
  domain: Domain;
  emptyMessage: string;
  /** Optional tracker or link card rendered between header and list. */
  children?: React.ReactNode;
}) {
  const items = await getDomainItems(domain);
  // Updates live inside their parent, so they don't count as open work.
  const parents = items.filter((item) => item.type !== "update");
  const open = parents.filter((item) => item.status !== "done");
  const critical = open.filter((item) => item.priority === 1);
  const meta = DOMAIN_META[domain];

  return (
    <div className="space-y-5">
      <header className="stagger-2">
        <p className="eyebrow">{meta.blurb}</p>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h1 className="font-display text-3xl font-semibold">{meta.label}</h1>
          <p className="mono text-sm text-ink-dim">
            <span className="text-ink">{open.length}</span> open
            {critical.length > 0 && (
              <span className="ml-3 font-semibold text-brass">
                {critical.length} critical
              </span>
            )}
          </p>
        </div>
      </header>

      <div className="stagger-3 space-y-5">
        {children}
        <QuickAdd domain={domain} />
        <ItemList items={items} emptyMessage={emptyMessage} />
      </div>
    </div>
  );
}
