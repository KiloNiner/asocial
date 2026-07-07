/** Theme registry shared by the schema, selector UI, and layout stamping. */
export const THEMES = [
  { id: "paper", kind: "light" },
  { id: "latte", kind: "light" },
  { id: "dawn", kind: "light" },
  { id: "mocha", kind: "dark" },
  { id: "tokyo-night", kind: "dark" },
  { id: "rose-pine", kind: "dark" },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];
export type ThemeChoice = "auto" | ThemeId;

export const THEME_CHOICES: ThemeChoice[] = [
  "auto",
  ...THEMES.map((t) => t.id),
];

export const THEME_COOKIE = "asocial_theme";

export function isThemeChoice(value: string): value is ThemeChoice {
  return (THEME_CHOICES as string[]).includes(value);
}

/**
 * Swatch preview colors (surface + accent) for the selector, kept in sync
 * with the palettes in globals.css.
 */
export const THEME_SWATCHES: Record<
  ThemeId,
  { surface: string; panel: string; accent: string; ink: string }
> = {
  paper: { surface: "#fafaf9", panel: "#ffffff", accent: "#0f766e", ink: "#1c1917" },
  latte: { surface: "#e6e9ef", panel: "#eff1f5", accent: "#179299", ink: "#4c4f69" },
  dawn: { surface: "#faf4ed", panel: "#fffaf3", accent: "#286983", ink: "#575279" },
  mocha: { surface: "#1e1e2e", panel: "#28283c", accent: "#94e2d5", ink: "#cdd6f4" },
  "tokyo-night": { surface: "#1a1b26", panel: "#1f2335", accent: "#7aa2f7", ink: "#c0caf5" },
  "rose-pine": { surface: "#191724", panel: "#1f1d2e", accent: "#9ccfd8", ink: "#e0def4" },
};
