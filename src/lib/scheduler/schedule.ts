import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  circles,
  friendCircles,
  friends,
  interactions,
  tasks,
  userSettings,
  type Task,
} from "@/db/schema";
import { today, type LocalDate } from "./clock";
import { addDays } from "./dates";
import { effectiveInterval, governingCircle } from "./interval";
import { jitteredInterval, uniformInt, type Rng } from "./jitter";
import { pickActivityType } from "./activity-picker";
import * as q from "@/lib/db/queries";

export function pendingTask(
  userId: string,
  friendId: string,
  kind: "contact" | "birthday",
): Task | null {
  return (
    db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.userId, userId),
          eq(tasks.friendId, friendId),
          eq(tasks.kind, kind),
          eq(tasks.status, "pending"),
        ),
      )
      .get() ?? null
  );
}

/**
 * The type not to suggest twice in a row: the friend's latest actual
 * interaction wins (real behavior), else the latest resolved task suggestion.
 */
function lastTypeId(userId: string, friendId: string): string | null {
  const lastInteraction = db
    .select({ typeId: interactions.contactTypeId })
    .from(interactions)
    .where(
      and(
        eq(interactions.userId, userId),
        eq(interactions.friendId, friendId),
      ),
    )
    .orderBy(desc(interactions.occurredOn), desc(interactions.createdAt))
    .get();
  if (lastInteraction) return lastInteraction.typeId;

  const lastTask = db
    .select({ typeId: tasks.suggestedTypeId })
    .from(tasks)
    .where(
      and(
        eq(tasks.userId, userId),
        eq(tasks.friendId, friendId),
        eq(tasks.kind, "contact"),
      ),
    )
    .orderBy(desc(tasks.createdAt))
    .get();
  return lastTask?.typeId ?? null;
}

/**
 * Schedule the next contact task for a friend: jittered interval from
 * baseDate, clamped so it never spawns already overdue, with a weighted
 * random activity suggestion. No-op if a pending contact task exists.
 *
 * `firstContact` (for a just-added friend) lands the suggestion soon — within
 * the action window rather than a full interval out — so a new friend is
 * something to act on now, not a marker a month away. It never lands later
 * than the normal cadence would.
 */
export function scheduleNextTask(
  userId: string,
  friendId: string,
  baseDate: LocalDate,
  opts: {
    origin?: "auto" | "manual";
    firstContact?: boolean;
    rng?: Rng;
  } = {},
): Task | null {
  const { origin = "auto", firstContact = false, rng = Math.random } = opts;
  if (pendingTask(userId, friendId, "contact")) return null;

  const friend = db
    .select()
    .from(friends)
    .where(and(eq(friends.id, friendId), eq(friends.userId, userId)))
    .get();
  if (!friend || friend.archived) return null;

  const settings = db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .get();
  if (!settings) return null;

  const friendCircleRows = db
    .select({ circle: circles })
    .from(friendCircles)
    .innerJoin(circles, eq(friendCircles.circleId, circles.id))
    .where(eq(friendCircles.friendId, friendId))
    .all()
    .map((r) => r.circle);

  const interval = effectiveInterval(friend, friendCircleRows, settings);
  const normalGap = jitteredInterval(interval.days, settings.jitterPct, rng);
  const gap = firstContact
    ? uniformInt(1, Math.min(settings.actionWindowDays, normalGap), rng)
    : normalGap;
  const t = today(settings.timezone);
  let due = addDays(baseDate, gap);
  if (due <= t) {
    // Friend fell through the cracks: land the nudge gently 1-3 days out
    // instead of spawning an already-late task.
    due = addDays(t, uniformInt(1, 3, rng));
  }

  const governing = governingCircle(friend, friendCircleRows);
  const suggestedTypeId = pickActivityType(
    q
      .listContactTypes(userId)
      .filter((type) => type.id !== "congratulate"),
    {
      friendPrefs: q.getFriendPrefs(userId, friendId),
      circlePrefs: governing
        ? q.getCirclePrefs(userId, governing.id)
        : new Map(),
      userPrefs: q.getUserPrefs(userId),
    },
    lastTypeId(userId, friendId),
    rng,
  );
  if (!suggestedTypeId) return null; // every type disabled — nothing to nudge

  return db
    .insert(tasks)
    .values({
      userId,
      friendId,
      kind: "contact",
      suggestedTypeId,
      dueDate: due,
      windowDays: settings.actionWindowDays,
      status: "pending",
      origin,
    })
    .returning()
    .get();
}
