import type { Metadata } from "next";
import { getDomainItems } from "@/lib/queries";
import { DOMAIN_META } from "@/lib/types";
import { QuickAdd } from "@/components/QuickAdd";
import { PersonalBoard } from "@/components/PersonalBoard";

export const metadata: Metadata = { title: "Personal" };

export default async function PersonalPage() {
  const items = await getDomainItems("personal");
  const parents = items.filter((item) => item.type !== "update");
  const open = parents.filter((item) => item.status !== "done");
  const critical = open.filter((item) => item.priority === 1);
  const meta = DOMAIN_META.personal;

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

      <div className="stagger-3 space-y-6">
        <QuickAdd domain="personal" withSubgroup />
        <PersonalBoard items={items} />
      </div>
    </div>
  );
}
