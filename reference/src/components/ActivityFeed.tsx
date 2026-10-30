import { timeAgo } from "@/lib/dates";
import { DOMAIN_META, isDomain, type ActivityEntry } from "@/lib/types";

export function ActivityFeed({ entries }: { entries: ActivityEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-ink-faint">
        No activity yet. Every move gets logged here.
      </p>
    );
  }

  return (
    <ol className="space-y-3">
      {entries.map((entry) => (
        <li key={entry.id} className="flex gap-3">
          <span
            className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
              entry.source === "voice"
                ? "bg-danger"
                : entry.source === "command"
                  ? "bg-signal"
                  : "bg-ink-faint"
            }`}
            title={entry.source}
          />
          <div className="min-w-0">
            <p className="text-sm leading-snug text-ink-dim">
              {entry.domain && isDomain(entry.domain) && (
                <span className="mono mr-1.5 text-[10px] uppercase text-ink-faint">
                  {DOMAIN_META[entry.domain].short}
                </span>
              )}
              {entry.action}
            </p>
            <p className="mono mt-0.5 text-[10px] text-ink-faint">
              {timeAgo(entry.created_at)} ago
              {entry.source !== "ui" && ` · ${entry.source}`}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
