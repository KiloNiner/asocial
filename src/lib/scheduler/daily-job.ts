import { and, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  friends,
  interactions,
  jobRuns,
  tasks,
  userSettings,
  users,
  type Friend,
} from "@/db/schema";
import { localDateOf, today, type LocalDate } from "./clock";
import { daysBetween } from "./dates";
import { nextBirthday } from "./birthday";
import { pendingTask, scheduleNextTask } from "./schedule";

const BIRTHDAY_LOOKAHEAD_DAYS = 7;
const BIRTHDAY_WINDOW_DAYS = 2;

export type SchedulerStats = {
  skipped: boolean;
  contactTasksCreated: number;
  birthdayTasksCreated: number;
};

function serverToday(): LocalDate {
  return today(process.env.TZ ?? "Europe/Copenhagen");
}

/**
 * Claim today's run, or false when it's already been done.
 *
 * The claim row is written *before* the work, so a run that throws leaves a
 * row with finishedAt NULL. That used to be indistinguishable from a finished
 * run: the 04:30 cron and the boot catch-up both saw a row for today, backed
 * off, and the day went unscheduled until someone noticed. An unfinished row
 * is therefore reclaimable — a crashed attempt is not an attempt.
 *
 * Safe because the scheduler is fully synchronous (better-sqlite3), so two
 * runs cannot interleave within the process; the row is a restart guard, not
 * a cross-process mutex.
 */
function claimRun(job: string, runDate: string): boolean {
  const inserted = db
    .insert(jobRuns)
    .values({ job, runDate, startedAt: Date.now() })
    .onConflictDoNothing()
    .run();
  if (inserted.changes > 0) return true;
  const reclaimed = db
    .update(jobRuns)
    .set({ startedAt: Date.now() })
    .where(
      and(
        eq(jobRuns.job, job),
        eq(jobRuns.runDate, runDate),
        isNull(jobRuns.finishedAt),
      ),
    )
    .run();
  return reclaimed.changes > 0;
}

function finishRun(job: string, runDate: string, detail: unknown): void {
  db.update(jobRuns)
    .set({ finishedAt: Date.now(), detail: JSON.stringify(detail) })
    .where(and(eq(jobRuns.job, job), eq(jobRuns.runDate, runDate)))
    .run();
}

/**
 * Daily sweep: every active autoschedule friend without a pending nudge gets
 * one ("contact too sparse" catch), and upcoming birthdays get a birthday
 * task. Restart-safe via the job_runs lock; `force` bypasses the lock for
 * manual/test triggers.
 */
export function runDailyScheduler(force = false): SchedulerStats {
  const runDate = serverToday();
  if (!claimRun("scheduler", runDate) && !force) {
    return { skipped: true, contactTasksCreated: 0, birthdayTasksCreated: 0 };
  }

  const stats: SchedulerStats = {
    skipped: false,
    contactTasksCreated: 0,
    birthdayTasksCreated: 0,
  };

  const allUsers = db
    .select({ user: users, settings: userSettings })
    .from(users)
    .innerJoin(userSettings, eq(userSettings.userId, users.id))
    .all();

  for (const { user, settings } of allUsers) {
    const t = today(settings.timezone);
    const activeFriends = db
      .select()
      .from(friends)
      .where(and(eq(friends.userId, user.id), eq(friends.archived, false)))
      .all();

    // Contact sweep — friends missing a pending suggestion. The friend list is
    // handed over rather than re-queried; it's the same set.
    stats.contactTasksCreated += sweepUserContactTasks(
      user.id,
      settings.timezone,
      activeFriends,
    );

    for (const friend of activeFriends) {
      // Birthday sweep
      if (friend.birthMonth && friend.birthDay) {
        const occurrence = nextBirthday(friend.birthMonth, friend.birthDay, t);
        if (daysBetween(t, occurrence) <= BIRTHDAY_LOOKAHEAD_DAYS) {
          const existing = db
            .select({ n: sql<number>`count(*)` })
            .from(tasks)
            .where(
              and(
                eq(tasks.friendId, friend.id),
                eq(tasks.kind, "birthday"),
                eq(tasks.dueDate, occurrence),
              ),
            )
            .get();
          if (!existing || existing.n === 0) {
            db.insert(tasks)
              .values({
                userId: user.id,
                friendId: friend.id,
                kind: "birthday",
                suggestedTypeId: "congratulate",
                dueDate: occurrence,
                windowDays: BIRTHDAY_WINDOW_DAYS,
                status: "pending",
                origin: "auto",
              })
              .run();
            stats.birthdayTasksCreated++;
          }
        }
      }
    }
  }

  finishRun("scheduler", runDate, stats);
  return stats;
}

/**
 * Create a first/next contact suggestion for every active autoschedule friend
 * of a user that has no pending one. Base date = their latest interaction, else
 * their created date. Returns the number of tasks created. Shared by the daily
 * sweep and by data restore.
 *
 * `timezone` is the user's, not the server's: createdAt is an instant, and
 * reading its UTC calendar date put the base date a day early for anyone who
 * added a friend late in their local evening.
 */
export function sweepUserContactTasks(
  userId: string,
  timezone: string,
  prefetchedFriends?: Friend[],
): number {
  let created = 0;
  const activeFriends =
    prefetchedFriends ??
    db
      .select()
      .from(friends)
      .where(and(eq(friends.userId, userId), eq(friends.archived, false)))
      .all();

  for (const friend of activeFriends) {
    if (!friend.autoschedule || pendingTask(userId, friend.id, "contact")) {
      continue;
    }
    const lastInteraction = db
      .select({ occurredOn: interactions.occurredOn })
      .from(interactions)
      .where(
        and(
          eq(interactions.userId, userId),
          eq(interactions.friendId, friend.id),
        ),
      )
      .orderBy(desc(interactions.occurredOn))
      .get();
    const base =
      lastInteraction?.occurredOn ?? localDateOf(friend.createdAt, timezone);
    if (scheduleNextTask(userId, friend.id, base)) created++;
  }
  return created;
}

/**
 * True when today's scheduler run already *completed* (for boot catch-up).
 * A row that was claimed but never finished means the run crashed, which is
 * exactly the case the catch-up exists for — see claimRun.
 */
export function schedulerRanToday(): boolean {
  const row = db
    .select({ id: jobRuns.id })
    .from(jobRuns)
    .where(
      and(
        eq(jobRuns.job, "scheduler"),
        eq(jobRuns.runDate, serverToday()),
        isNotNull(jobRuns.finishedAt),
      ),
    )
    .get();
  return !!row;
}
