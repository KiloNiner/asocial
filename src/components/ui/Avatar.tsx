const sizes = {
  sm: "h-7 w-7 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-xl",
} as const;

/** First letters of the first and last word — "Anna Berg" → "AB". */
function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const first = Array.from(words[0])[0] ?? "";
  const last = words.length > 1 ? (Array.from(words.at(-1)!)[0] ?? "") : "";
  return (first + last).toUpperCase();
}

/**
 * A friend's (or user's) monogram, tinted with their governing circle color.
 * The color is user data, so it is mixed into the theme's own panel and ink
 * rather than used raw — that keeps the letters legible on all six themes.
 */
export function Avatar({
  name,
  color,
  size = "md",
}: Readonly<{ name: string; color?: string | null; size?: keyof typeof sizes }>) {
  const tint = color ?? "var(--t-dot)";
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 select-none items-center justify-center rounded-full font-bold ${sizes[size]}`}
      style={{
        backgroundColor: `color-mix(in srgb, ${tint} 22%, var(--t-panel))`,
        color: `color-mix(in srgb, ${tint} 55%, var(--t-ink))`,
        boxShadow: `inset 0 0 0 1.5px color-mix(in srgb, ${tint} 45%, transparent)`,
      }}
    >
      {initials(name)}
    </span>
  );
}
