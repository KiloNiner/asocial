import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  friends,
  interactions,
  jobRuns,
  tasks,
  userSettings,
  users,
} from "@/db/schema";
import { today, type LocalDate } from "./clock";
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

/** INSERT OR IGNORE claim on (job, runDate); false when already claimed. */
function claimRun(job: string, runDate: string): boolean {
  const result = db
    .insert(jobRuns)
    .values({ job, runDate, startedAt: Date.now() })
    .onConflictDoNothing()
    .run();
  return result.changes > 0;
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

    // Contact sweep — friends missing a pending suggestion.
    stats.contactTasksCreated += sweepUserContactTasks(user.id);

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
 */
export function sweepUserContactTasks(userId: string): number {
  let created = 0;
  const activeFriends = db
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
      lastInteraction?.occurredOn ??
      new Date(friend.createdAt).toISOString().slice(0, 10);
    if (scheduleNextTask(userId, friend.id, base)) created++;
  }
  return created;
}

/** True when today's scheduler run already happened (for boot catch-up). */
export function schedulerRanToday(): boolean {
  const row = db
    .select({ id: jobRuns.id })
    .from(jobRuns)
    .where(
      and(eq(jobRuns.job, "scheduler"), eq(jobRuns.runDate, serverToday())),
    )
    .get();
  return !!row;
}
