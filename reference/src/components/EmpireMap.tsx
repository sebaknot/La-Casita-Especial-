import Link from "next/link";
import {
  DOMAINS,
  DOMAIN_META,
  EMPTY_DOMAIN_STATS,
  type Domain,
  type DomainStats,
} from "@/lib/types";

/**
 * The Empire Map — eight domains in orbit around the S emblem.
 * Gold pulse = critical item present · steady = work open · dim = clear.
 */
export function EmpireMap({
  perDomain,
}: {
  perDomain: Record<Domain, DomainStats>;
}) {
  // Nodes on a circle, starting at 12 o'clock.
  const positions = DOMAINS.map((domain, index) => {
    const angle = (index / DOMAINS.length) * Math.PI * 2 - Math.PI / 2;
    return {
      domain,
      x: 50 + 40 * Math.cos(angle),
      y: 50 + 40 * Math.sin(angle),
    };
  });

  return (
    <div className="relative mx-auto aspect-square w-full max-w-md select-none">
      {/* Orbital lines */}
      <svg
        viewBox="0 0 100 100"
        className="absolute inset-0 h-full w-full"
        aria-hidden
      >
        <circle
          cx="50"
          cy="50"
          r="40"
          fill="none"
          stroke="#C9A227"
          strokeOpacity="0.25"
          strokeWidth="0.3"
        />
        <circle
          cx="50"
          cy="50"
          r="28"
          fill="none"
          stroke="#C9A227"
          strokeOpacity="0.12"
          strokeWidth="0.25"
          strokeDasharray="0.8 1.6"
        />
        {positions.map(({ domain, x, y }) => (
          <line
            key={domain}
            x1="50"
            y1="50"
            x2={x}
            y2={y}
            stroke="#232B3D"
            strokeWidth="0.25"
          />
        ))}
      </svg>

      {/* Center emblem */}
      <div className="absolute left-1/2 top-1/2 flex h-[18%] w-[18%] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-brass-soft/70 bg-surface">
        <span className="font-display text-2xl text-brass sm:text-3xl">S</span>
      </div>

      {/* Domain nodes */}
      {positions.map(({ domain, x, y }) => {
        // Falls back to zeros rather than assuming the payload has every key:
        // during a deploy the server and this component can briefly disagree
        // about the domain list, and a missing entry must not crash the page.
        const counts = perDomain[domain] ?? EMPTY_DOMAIN_STATS;
        const status =
          counts.critical > 0 ? "critical" : counts.open > 0 ? "active" : "idle";
        const meta = DOMAIN_META[domain];

        return (
          <Link
            key={domain}
            href={meta.path}
            aria-label={`${meta.label}: ${counts.open} open${
              counts.critical ? `, ${counts.critical} critical` : ""
            }`}
            style={{ left: `${x}%`, top: `${y}%` }}
            className={`group absolute flex h-[16.5%] w-[16.5%] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border bg-surface transition-transform hover:scale-105 ${
              status === "critical"
                ? "node-critical"
                : status === "active"
                  ? "border-hairline"
                  : "border-hairline/60 opacity-55"
            }`}
          >
            <span
              className={`text-[9px] font-semibold leading-none sm:text-[10px] ${
                status === "critical" ? "text-brass" : "text-ink"
              }`}
            >
              {meta.short}
            </span>
            <span className="mono mt-0.5 text-[9px] leading-none text-ink-faint">
              {counts.open > 0 ? counts.open : "·"}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
