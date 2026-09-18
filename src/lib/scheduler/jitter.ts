export type Rng = () => number;

/**
 * Randomize an interval by ±jitterPct so scheduled contact never falls on a
 * predictable rhythm. Uniform in [1-j, 1+j], never below 1 day.
 */
export function jitteredInterval(
  intervalDays: number,
  jitterPct: number,
  rng: Rng = Math.random,
): number {
  const j = jitterPct / 100;
  const factor = 1 + (rng() * 2 * j - j);
  return Math.max(1, Math.round(intervalDays * factor));
}

/** Uniform integer in [min, max], both inclusive. */
export function uniformInt(min: number, max: number, rng: Rng = Math.random): number {
  return min + Math.floor(rng() * (max - min + 1));
}

/**
 * How the gap to the next suggestion is drawn.
 *
 * - `normal` — the friend's own cadence, jittered. The default.
 * - `firstContact` — a just-added friend, landed inside the action window so
 *   they are something to act on now rather than a marker a month away.
 * - `spread` — anywhere between tomorrow and the full cadence. For
 *   rescheduling many friends at once: drawing them all at their full
 *   interval would land the whole address book in the same fortnight and
 *   rebuild the pile that the rescheduling was meant to clear.
 */
export type GapMode = "normal" | "firstContact" | "spread";

/** Days from the base date to the next suggestion, per `mode`. */
export function contactGap(
  normalGap: number,
  actionWindowDays: number,
  mode: GapMode,
  rng: Rng = Math.random,
): number {
  switch (mode) {
    case "firstContact":
      // Never later than the normal cadence would have put it.
      return uniformInt(1, Math.min(actionWindowDays, normalGap), rng);
    case "spread":
      return uniformInt(1, normalGap, rng);
    default:
      return normalGap;
  }
}
