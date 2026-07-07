import type { Circle, Friend, UserSettings } from "@/db/schema";

export type EffectiveInterval = {
  days: number;
  source:
    | { kind: "override" }
    | { kind: "circle"; circle: Circle }
    | { kind: "default" };
};

/**
 * Interval resolution: personal override wins, else the most frequent
 * (minimum-interval) circle, else the user's default interval.
 */
export function effectiveInterval(
  friend: Pick<Friend, "intervalOverrideDays">,
  friendCircles: Circle[],
  settings: Pick<UserSettings, "defaultIntervalDays">,
): EffectiveInterval {
  if (friend.intervalOverrideDays !== null) {
    return { days: friend.intervalOverrideDays, source: { kind: "override" } };
  }
  if (friendCircles.length > 0) {
    const governing = friendCircles.reduce((a, b) =>
      b.intervalDays < a.intervalDays ? b : a,
    );
    return {
      days: governing.intervalDays,
      source: { kind: "circle", circle: governing },
    };
  }
  return { days: settings.defaultIntervalDays, source: { kind: "default" } };
}

/** The circle whose rhythm governs this friend, if circles govern at all. */
export function governingCircle(
  friend: Pick<Friend, "intervalOverrideDays">,
  friendCircles: Circle[],
): Circle | null {
  const resolved = effectiveInterval(friend, friendCircles, {
    defaultIntervalDays: 1,
  });
  return resolved.source.kind === "circle" ? resolved.source.circle : null;
}
