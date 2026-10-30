import { getHomeData } from "@/lib/queries";
import { formatLongDate, greeting } from "@/lib/dates";
import { EmpireMap } from "@/components/EmpireMap";
import { TodayBoard } from "@/components/TodayBoard";
import { ActivityFeed } from "@/components/ActivityFeed";

export const dynamic = "force-dynamic";

export default async function CommandPage() {
  const data = await getHomeData();

  const statusLine =
    data.criticalCount + data.dueTodayCount + data.dueThisWeekCount === 0
      ? "All fronts quiet."
      : [
          data.criticalCount > 0 && `${data.criticalCount} critical`,
          data.dueTodayCount > 0 && `${data.dueTodayCount} due today`,
          data.dueThisWeekCount > 0 && `${data.dueThisWeekCount} due this week`,
        ]
          .filter(Boolean)
          .join(" · ");

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_280px]">
      <div className="min-w-0 space-y-8">
        {/* Greeting + empire status */}
        <header className="stagger-2">
          <p className="eyebrow">{formatLongDate()}</p>
          <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">
            {greeting()}.
          </h1>
          <p className="mono mt-2 text-sm">
            <span
              className={
                data.criticalCount > 0 ? "font-semibold text-brass" : "text-ink-dim"
              }
            >
              {statusLine}
            </span>
          </p>
        </header>

        {/* Empire Map */}
        <section className="stagger-3" aria-label="Empire map">
          <EmpireMap perDomain={data.perDomain} />
        </section>

        {/* Today's Board */}
        <section className="stagger-3" aria-label="Today's board">
          <h2 className="eyebrow mb-3">Today</h2>
          <TodayBoard items={data.openItems} />
        </section>
      </div>

      {/* Right rail: activity */}
      <aside className="stagger-3 lg:border-l lg:border-hairline lg:pl-6">
        <h2 className="eyebrow mb-3">Activity</h2>
        <ActivityFeed entries={data.activity} />
      </aside>
    </div>
  );
}
