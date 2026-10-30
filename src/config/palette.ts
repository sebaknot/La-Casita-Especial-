/**
 * Person colors. Soft fills for chips, a stronger stroke for dots and left
 * borders, and an ink that keeps 4.5:1 contrast on the soft fill.
 * Colors identify people only — they never replace a text label.
 */
export type PaletteKey = "blue" | "teal" | "coral" | "lavender" | "amber" | "rose" | "green" | "slate";

export interface Swatch {
  stroke: string;
  soft: string;
  ink: string;
}

export const PALETTE: Record<PaletteKey, Swatch> = {
  blue: { stroke: "#3B82D6", soft: "#E3EEFB", ink: "#1D4F8F" },
  teal: { stroke: "#2A9D8F", soft: "#DDF3F0", ink: "#17645B" },
  coral: { stroke: "#E0735A", soft: "#FCE8E3", ink: "#9A3A24" },
  lavender: { stroke: "#8B7BD8", soft: "#EEEBFA", ink: "#4C3D99" },
  amber: { stroke: "#D49A2A", soft: "#FAF0D9", ink: "#7A5310" },
  rose: { stroke: "#D46A8E", soft: "#FAE6ED", ink: "#8E2F52" },
  green: { stroke: "#4CAF7A", soft: "#E1F5E9", ink: "#1F6B43" },
  slate: { stroke: "#7C8798", soft: "#ECEFF3", ink: "#3E4756" },
};

export const PALETTE_KEYS = Object.keys(PALETTE) as PaletteKey[];

export function swatch(color: string | null | undefined): Swatch {
  return PALETTE[(color ?? "slate") as PaletteKey] ?? PALETTE.slate;
}
