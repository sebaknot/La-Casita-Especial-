import Link from "next/link";
import { Icon, type IconName } from "@/components/icons";

/** Empty states are invitations, not dead ends. */
export function EmptyState({
  message,
  actionLabel,
  href,
  icon = "sparkle",
}: {
  message: string;
  actionLabel?: string;
  href?: string;
  icon?: IconName;
}) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-line-strong bg-surface/60 px-4 py-5 text-ink-dim">
      <div className="flex items-start gap-3">
        <Icon name={icon} className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <p>{message}</p>
      </div>
      {actionLabel && href && (
        <Link
          href={href}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-primary-soft px-3 font-semibold text-primary-strong hover:bg-primary/15"
        >
          <Icon name="plus" className="h-4 w-4" />
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
