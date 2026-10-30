import Link from "next/link";
import { Icon } from "@/components/icons";
import { PILLAR_KEYS, PILLARS, type PillarKey } from "@/config/pillars";
import { pillarName, type Dictionary } from "@/i18n";
import { getT, requireHousehold } from "@/lib/session";

export default async function PillarsPage() {
  const session = await requireHousehold();
  const t = await getT();

  const { data } = await session.supabase
    .from("items")
    .select("pillar_key")
    .eq("household_id", session.household.id)
    .is("parent_id", null)
    .in("status", ["open", "in_progress", "waiting"]);
  const counts = new Map<string, number>();
  for (const row of data ?? []) counts.set(row.pillar_key as string, (counts.get(row.pillar_key as string) ?? 0) + 1);

  const main = PILLAR_KEYS.filter((key) => !PILLARS[key].group);
  const extended = PILLAR_KEYS.filter((key) => PILLARS[key].group === "extended");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t.pillarsPage.title}</h1>
        <p className="text-ink-dim">{t.pillarsPage.intro}</p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {main.map((key) => (
          <PillarTile key={key} pillarKey={key} count={counts.get(key) ?? 0} t={t} />
        ))}
      </ul>
      <section aria-labelledby="extended-title">
        <h2 id="extended-title" className="mb-2 text-lg font-semibold">
          {t.pillarsPage.extendedGroup}
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {extended.map((key) => (
            <PillarTile key={key} pillarKey={key} count={counts.get(key) ?? 0} t={t} />
          ))}
        </ul>
      </section>
    </div>
  );
}

function PillarTile({ pillarKey, count, t }: { pillarKey: PillarKey; count: number; t: Dictionary }) {
  const config = PILLARS[pillarKey];
  return (
    <li>
      <Link
        href={`/p/${pillarKey}`}
        className="flex min-h-24 items-start gap-3 rounded-2xl border border-line bg-surface p-4 hover:border-primary/50 hover:shadow-sm"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-strong">
          <Icon name={config.icon} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-2">
            <span className="font-semibold text-ink">{pillarName(t, pillarKey)}</span>
            {count > 0 && <span className="tabular rounded-full bg-sunk px-2 py-0.5 text-sm text-ink-dim">{count}</span>}
          </span>
          <span className="block text-sm text-ink-dim">{t.pillars[pillarKey].blurb}</span>
          <span className="mt-1.5 flex flex-wrap gap-1.5 text-xs font-semibold">
            <span className={`rounded-full px-2 py-0.5 ${config.status === "shell" ? "bg-sunk text-ink-dim" : "bg-mint-soft text-mint-ink"}`}>
              {t.pillarsPage[config.status]}
            </span>
            {config.sensitive && (
              <span className="inline-flex items-center gap-1 rounded-full bg-sunk px-2 py-0.5 text-ink-dim">
                <Icon name="lock" className="h-3 w-3" />
                {t.pillarsPage.sensitive}
              </span>
            )}
          </span>
        </span>
      </Link>
    </li>
  );
}
