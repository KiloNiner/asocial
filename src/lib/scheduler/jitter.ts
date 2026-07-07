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
