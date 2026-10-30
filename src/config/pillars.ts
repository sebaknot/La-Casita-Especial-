/**
 * The one canonical pillar list.
 *
 * `Record<PillarKey, PillarConfig>` makes the compiler reject a pillar that is
 * added to the union but not configured here (and the i18n dictionaries are
 * typed the same way, so its name can't be forgotten either). The database
 * `pillars` rows are synced FROM this file — never edit them by hand.
 *
 * Every runtime lookup goes through pillarConfig(), which falls back instead
 * of crashing on a key the code doesn't know (e.g. mid-deploy).
 */
import type { IconName } from "../components/icons.tsx";

export type PillarKey =
  | "kids"
  | "work"
  | "home"
  | "faith"
  | "family"
  | "health"
  | "extended"
  | "extended_private"
  | "relative_projects"
  | "business_winddown"
  | "sales"
  | "finances";

export type PillarView = "kids" | "work" | "list";
export type PillarStatus = "built" | "light" | "shell";

export interface PillarConfig {
  icon: IconName;
  /**
   * Sensitive means ONLY: command-bar AI parsing is off on this pillar and
   * the typed command (raw_input) is never stored. It hides nothing from a
   * household member.
   */
  sensitive: boolean;
  view: PillarView;
  status: PillarStatus;
  /** Pillars sharing a group are shown together as a sub-dashboard. */
  group?: "extended";
  sortOrder: number;
}

export const PILLARS: Record<PillarKey, PillarConfig> = {
  kids: { icon: "sparkle", sensitive: false, view: "kids", status: "built", sortOrder: 1 },
  work: { icon: "briefcase", sensitive: true, view: "work", status: "built", sortOrder: 2 },
  home: { icon: "home", sensitive: false, view: "list", status: "light", sortOrder: 3 },
  faith: { icon: "candle", sensitive: false, view: "list", status: "light", sortOrder: 4 },
  family: { icon: "gift", sensitive: false, view: "list", status: "shell", sortOrder: 5 },
  health: { icon: "heart", sensitive: false, view: "list", status: "shell", sortOrder: 6 },
  extended: { icon: "people", sensitive: false, view: "list", status: "shell", group: "extended", sortOrder: 7 },
  extended_private: { icon: "lock", sensitive: true, view: "list", status: "shell", group: "extended", sortOrder: 8 },
  relative_projects: { icon: "folder", sensitive: true, view: "list", status: "shell", sortOrder: 9 },
  business_winddown: { icon: "checklist", sensitive: false, view: "list", status: "shell", sortOrder: 10 },
  sales: { icon: "tag", sensitive: false, view: "list", status: "shell", sortOrder: 11 },
  finances: { icon: "wallet", sensitive: true, view: "list", status: "shell", sortOrder: 12 },
};

export const PILLAR_KEYS = (Object.keys(PILLARS) as PillarKey[]).sort(
  (a, b) => PILLARS[a].sortOrder - PILLARS[b].sortOrder,
);

export const FALLBACK_PILLAR: PillarConfig = {
  icon: "folder",
  // Unknown pillars are treated as sensitive: safest default for AI + raw_input.
  sensitive: true,
  view: "list",
  status: "shell",
  sortOrder: 99,
};

export function isPillarKey(value: unknown): value is PillarKey {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(PILLARS, value);
}

export function pillarConfig(key: string | null | undefined): PillarConfig {
  return (key && isPillarKey(key) ? PILLARS[key] : undefined) ?? FALLBACK_PILLAR;
}
