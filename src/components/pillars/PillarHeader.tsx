import Link from "next/link";
import { Icon } from "@/components/icons";
import { pillarConfig } from "@/config/pillars";
import { pillarName, type Dictionary } from "@/i18n";

export function PillarHeader({ pillarKey, t }: { pillarKey: string; t: Dictionary }) {
  const config = pillarConfig(pillarKey);
  const blurb = (t.pillars as Record<string, { blurb: string }>)[pillarKey]?.blurb;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-primary-strong">
            <Icon name={config.icon} className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{pillarName(t, pillarKey)}</h1>
            {blurb && <p className="text-ink-dim">{blurb}</p>}
          </div>
        </div>
        <Link
          href={`/add?pillar=${pillarKey}&back=/p/${pillarKey}`}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-primary px-4 font-semibold text-white hover:bg-primary-strong"
        >
          <Icon name="plus" className="h-4 w-4" />
          {t.pillar.addHere}
        </Link>
      </div>
      {config.sensitive && (
        <p className="flex items-start gap-2 rounded-xl bg-sunk px-3 py-2 text-ink-dim">
          <Icon name="lock" className="mt-0.5 h-4 w-4 shrink-0" />
          {t.pillar.sensitiveNote}
        </p>
      )}
    </div>
  );
}
