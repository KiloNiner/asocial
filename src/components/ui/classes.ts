// text-base (16px), not text-sm: below 16px iOS Safari auto-zooms on focus
// and — since navigating away doesn't blur the field first — never zooms
// back out, leaving the whole page zoomed in after e.g. a login redirect.
export const inputClass =
  "min-w-0 rounded-lg border border-field-border bg-field px-3 py-2 text-base " +
  "font-normal text-ink placeholder:text-subtle transition-colors " +
  "focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30";

const buttonBase =
  "inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 " +
  "text-sm font-semibold transition active:translate-y-px " +
  "disabled:pointer-events-none disabled:opacity-50";

export const buttonClass =
  `${buttonBase} bg-accent text-on-accent shadow-sm hover:bg-accent-strong`;

export const buttonGhostClass =
  `${buttonBase} border border-line bg-panel text-ink hover:bg-faint`;

/** Text-only action: cancel, dismiss, a secondary way out. */
export const buttonQuietClass =
  "inline-flex items-center gap-1.5 rounded-lg px-2 py-2 text-sm font-medium " +
  "text-muted transition hover:text-ink disabled:opacity-50";

export const cardClass =
  "rounded-2xl border border-line bg-panel p-4 shadow-card sm:p-5";

/** A bordered list whose rows are separated by hairlines. */
export const listClass =
  "divide-y divide-line overflow-hidden rounded-2xl border border-line " +
  "bg-panel shadow-card";

export const labelClass = "flex flex-col gap-1.5 text-sm font-medium";

/** Helper text under a field; resets the weight a label hands down. */
export const hintClass = "text-xs font-normal text-muted";

export const errorClass =
  "rounded-lg bg-warn-soft px-3 py-2 text-sm font-medium text-warn";

export const successClass = "text-sm font-medium text-accent";

export const linkClass =
  "font-medium text-accent underline-offset-2 hover:underline";

/** Page title. */
export const h1Class = "text-2xl font-extrabold tracking-tight sm:text-3xl";

/** Section title on a page or card. */
export const h2Class = "text-lg font-bold tracking-tight";

/** Small caps label over a group. */
export const eyebrowClass =
  "text-xs font-bold uppercase tracking-wider text-subtle";

export const chipClass =
  "inline-flex items-center gap-1.5 rounded-full border border-line bg-panel " +
  "px-2.5 py-0.5 text-xs font-medium text-muted";

export const checkboxClass = "h-4 w-4 shrink-0 accent-accent";
