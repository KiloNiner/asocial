import type { ContactType } from "@/db/schema";
import type { Rng } from "./jitter";

export type WeightSources = {
  friendPrefs: ReadonlyMap<string, number>;
  /** Prefs of the circle governing the friend's interval, if any. */
  circlePrefs: ReadonlyMap<string, number>;
  userPrefs: ReadonlyMap<string, number>;
};

type PickableType = Pick<ContactType, "id" | "defaultWeight" | "archived">;

/**
 * Weight resolution per type — first level that defines a weight wins:
 * friend → governing circle → user → type default. Mirrors the interval
 * resolution order so behavior stays predictable.
 */
export function resolveWeight(
  type: PickableType,
  sources: WeightSources,
): number {
  return (
    sources.friendPrefs.get(type.id) ??
    sources.circlePrefs.get(type.id) ??
    sources.userPrefs.get(type.id) ??
    type.defaultWeight
  );
}

/**
 * Weighted random pick of the suggested activity. Archived and zero-weight
 * types never surface; the last-used type is excluded when an alternative
 * exists, so suggestions don't repeat back to back. Returns null when
 * nothing is pickable (all weights 0).
 */
export function pickActivityType(
  types: PickableType[],
  sources: WeightSources,
  lastTypeId: string | null,
  rng: Rng = Math.random,
): string | null {
  const weights = new Map<string, number>();
  for (const type of types) {
    if (type.archived) continue;
    const weight = resolveWeight(type, sources);
    if (weight > 0) weights.set(type.id, weight);
  }

  if (lastTypeId !== null && weights.size > 1) {
    weights.delete(lastTypeId);
  }
  if (weights.size === 0) return null;

  const total = [...weights.values()].reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (const [id, weight] of weights) {
    r -= weight;
    if (r < 0) return id;
  }
  // Floating-point edge: fall back to the last entry.
  return [...weights.keys()].at(-1) ?? null;
}
