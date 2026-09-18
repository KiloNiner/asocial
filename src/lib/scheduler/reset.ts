import { and, eq, lte } from "drizzle-orm";
import { db } from "@/db";
import { friends, tasks } from "@/db/schema";
import { today, type LocalDate } from "./clock";
import { summarizeBacklog, type BacklogSummary } from "./backlog";
import type { Rng } from "./jitter";
import { scheduleNextTask } from "./schedule";

export type StartFreshResult = { cleared: number; scheduled: number };

function activeAutoFriendIds(userId: string): string[] {
  return db
    .select({ id: friends.id })
    .from(friends)
    .where(
      and(
        eq(friends.userId, userId),
        eq(friends.archived, false),
        eq(friends.autoschedule, true),
      ),
    )
    .all()
    .map((row) => row.id);
}

/** What is open right now, and how much of the address book it accounts for. */
export function contactBacklog(userId: string, timezone: string): BacklogSummary {
  const pending = db
    .select({ dueDate: tasks.dueDate, windowDays: tasks.windowDays })
    .from(tasks)
    .innerJoin(friends, eq(tasks.friendId, friends.id))
    .where(
      and(
        eq(tasks.userId, userId),
        eq(tasks.kind, "contact"),
        eq(tasks.status, "pending"),
        eq(friends.archived, false),
      ),
    )
    .all();
  return summarizeBacklog(
    pending,
    activeAutoFriendIds(userId).length,
    today(timezone),
  );
}

/**
 * Clear the backlog and draw the rhythm again.
 *
 * Every escape hatch asocial had was per suggestion — skip one, snooze one,
 * move one — so the cost of recovering scaled with how far behind someone
 * was, which is exactly backwards. This is the bulk form of the skip button
 * and nothing more: same `skipped` state, same guilt-free meaning.
 *
 * Two details it would be easy to get wrong:
 *
 * Suggestions are resolved *before* new ones are drawn, because
 * scheduleNextTask no-ops while a pending contact task exists.
 *
 * And the new ones are drawn with `spread` rather than at each friend's full
 * cadence. Scheduling everyone from today at their own interval would land
 * the whole address book in one band a month out and rebuild the same pile a
 * month later — the version of this feature that has to be used repeatedly.
 * `firstContact` is no good either: it clamps to the action window, which
 * would dump every friend into the next few days.
 *
 * Only what is already open is cleared. A suggestion that has not opened yet
 * was never part of the pile.
 */
export function startFreshContactTasks(
  userId: string,
  timezone: string,
  rng?: Rng,
): StartFreshResult {
  const t: LocalDate = today(timezone);

  const cleared = db
    .update(tasks)
    .set({ status: "skipped", completedAt: Date.now() })
    .where(
      and(
        eq(tasks.userId, userId),
        eq(tasks.kind, "contact"),
        eq(tasks.status, "pending"),
        lte(tasks.dueDate, t),
      ),
    )
    .run().changes;

  let scheduled = 0;
  for (const friendId of activeAutoFriendIds(userId)) {
    if (scheduleNextTask(userId, friendId, t, { gap: "spread", rng })) {
      scheduled++;
    }
  }
  return { cleared, scheduled };
}
