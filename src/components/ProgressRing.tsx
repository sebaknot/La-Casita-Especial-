/**
 * A quiet progress ring: Bible chapters, project steps, routine streaks.
 * The label is the accessible name; the numbers inside are decorative.
 */
export function ProgressRing({
  value,
  max,
  size = 56,
  label,
  center,
  tone = "primary",
}: {
  value: number;
  max: number;
  size?: number;
  label: string;
  center?: React.ReactNode;
  tone?: "primary" | "mint";
}) {
  const stroke = Math.max(4, Math.round(size / 10));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const color = tone === "mint" || ratio >= 1 ? "var(--color-mint-ink)" : "var(--color-primary)";

  return (
    <div role="img" aria-label={label} className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--color-sunk)" strokeWidth={stroke} />
        <circle
          className="ring-progress"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - ratio)}
        />
      </svg>
      <span aria-hidden className="tabular absolute text-[0.72rem] font-semibold text-ink">
        {center ?? `${Math.round(ratio * 100)}%`}
      </span>
    </div>
  );
}
