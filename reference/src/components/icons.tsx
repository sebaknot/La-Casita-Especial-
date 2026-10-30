/** Minimal geometric line icons — command deck, not emoji. */

interface IconProps {
  className?: string;
}

const base = {
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  viewBox: "0 0 24 24",
  "aria-hidden": true as const,
};

export function IconCommand({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="12" r="3.2" />
      <circle cx="12" cy="12" r="9" strokeDasharray="3 3.5" />
    </svg>
  );
}

export function IconLedger({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="5" y="3.5" width="14" height="17" rx="1.5" />
      <path d="M9 8h6M9 12h6M9 16h3.5" />
    </svg>
  );
}

export function IconCircuit({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="8" y="8" width="8" height="8" rx="1" />
      <path d="M12 3v5M12 16v5M3 12h5M16 12h5" />
    </svg>
  );
}

export function IconRoute({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="6" cy="18" r="2.2" />
      <circle cx="18" cy="6" r="2.2" />
      <path d="M8 17h6a4 4 0 0 0 4-4v-3.5" />
    </svg>
  );
}

export function IconKeystone({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 20v-9l8-6 8 6v9" />
      <path d="M9.5 20v-5h5v5" />
    </svg>
  );
}

export function IconLaurel({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 4v10" />
      <path d="M12 8c-3 0-5-2-5-4 3 0 5 2 5 4zM12 8c3 0 5-2 5-4-3 0-5 2-5 4z" />
      <path d="M7 14a5 5 0 0 0 10 0" />
      <path d="M12 18v2.5" />
    </svg>
  );
}

export function IconScales({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 4v16M7 20h10M5 8h14l-3-2.5" />
      <path d="M5 8l-2.5 5a3 3 0 0 0 5 0zM19 8l2.5 5a3 3 0 0 1-5 0z" />
    </svg>
  );
}

export function IconSeal({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="9.5" r="5.5" />
      <path d="M9.2 9.4l1.9 1.9 3.7-3.9" />
      <path d="M8.5 14.5L7 21l5-2.2L17 21l-1.5-6.5" />
    </svg>
  );
}

export function IconShield({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 3.5 19 6v5.5c0 4.5-3 7.8-7 9-4-1.2-7-4.5-7-9V6l7-2.5z" />
      <path d="M9.2 11.8l2 2 3.6-3.9" />
    </svg>
  );
}

export function IconGrid({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="4" y="4" width="7" height="7" rx="1" />
      <rect x="13" y="4" width="7" height="7" rx="1" />
      <rect x="4" y="13" width="7" height="7" rx="1" />
      <rect x="13" y="13" width="7" height="7" rx="1" />
    </svg>
  );
}

export function IconMic({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="9.5" y="3.5" width="5" height="10" rx="2.5" />
      <path d="M6 11.5a6 6 0 0 0 12 0M12 17.5v3" />
    </svg>
  );
}

export function IconChevron({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

export function IconExit({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10" />
    </svg>
  );
}

export function IconMenu({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}
