import { and, eq, inArray } from "drizzle-orm";
import { TZDate } from "@date-fns/tz";
import { db } from "@/db";
import {
  contactTypes,
  friends,
  jobRuns,
  notificationChannels,
  notificationLog,
  tasks,
  users,
  userSettings,
  type UserSettings,
} from "@/db/schema";
import { today } from "@/lib/scheduler/clock";
import { composeDigest, type DigestTask } from "./digest";
import type { ChannelId, NotificationChannel } from "./channel";
import { pushoverChannel } from "./channels/pushover";
import { emailChannel } from "./channels/email";
import { digestTranslator } from "./messages";

export const channelRegistry: Record<ChannelId, NotificationChannel> = {
  pushover: pushoverChannel,
  email: emailChannel,
};

/**
 * One line in `docker logs` per hourly tick. The counters exist to make a
 * quiet day distinguishable from a broken one: since the anti-nag rule holds
 * a lingering task back until its 3rd day, `sent: 0` is the *expected*
 * outcome most days, so every considered user has to be accounted for
 * somewhere. `usersConsidered` should equal `quiet` plus the users behind
 * `sent`/`failed`/`settled`.
 */
export type DispatchStats = {
  skipped: boolean;
  sent: number;
  failed: number;
  usersConsidered: number;
  /** Past their digest hour with nothing to say today. The common case. */
  quiet: number;
  /** Channel sends skipped because this local day is already resolved --
   *  either it went out, or it failed MAX_SEND_ATTEMPTS times (those
   *  attempts are logged individually as `[digest] send failed`). */
  settled: number;
};

function pendingDigestTasks(
  userId: string,
  locale: UserSettings["locale"],
): DigestTask[] {
  const t = digestTranslator(locale);
  const rows = db
    .select({ task: tasks, friendName: friends.name, type: contactTypes })
    .from(tasks)
    .innerJoin(friends, eq(tasks.friendId, friends.id))
    .innerJoin(contactTypes, eq(tasks.suggestedTypeId, contactTypes.id))
    .where(and(eq(tasks.userId, userId), eq(tasks.status, "pending")))
    .all();
  return rows.map(({ task, friendName, type }) => ({
    id: task.id,
    kind: task.kind,
    dueDate: task.dueDate,
    friendName,
    typeEmoji: type.emoji ?? "",
    // Built-in ids are a closed set, but the string type of type.id defeats
    // next-intl's key typing — cast the key.
    typeLabel:
      type.name ??
      t(`contactTypes.${type.id}` as Parameters<typeof t>[0]),
  }));
}

// Retries left after a failure, per user/channel/local day. A transient SMTP
// or Pushover blip deserves another go on the next tick; a permanently
// misconfigured channel should not reconnect and log hourly until midnight.
const MAX_SEND_ATTEMPTS = 3;

/**
 * True when this user/channel/day is done with: it either went out, or it has
 * failed often enough that retrying is just noise.
 */
function digestSettled(
  userId: string,
  channel: string,
  digestDate: string,
): boolean {
  const rows = db
    .select({ status: notificationLog.status })
    .from(notificationLog)
    .where(
      and(
        eq(notificationLog.userId, userId),
        eq(notificationLog.channel, channel),
        eq(notificationLog.kind, "digest"),
        eq(notificationLog.digestDate, digestDate),
      ),
    )
    .all();
  return (
    rows.some((row) => row.status === "sent") || rows.length >= MAX_SEND_ATTEMPTS
  );
}

/**
 * Hourly dispatch: sends each user's digest at or after their local digest
 * hour via every enabled channel. Dedupe: one sent digest per
 * user/channel/local day, and at most MAX_SEND_ATTEMPTS tries. `force` skips
 * the run-lock and the hour check (manual/test trigger) but never the log.
 */
export async function runDigestDispatch(force = false): Promise<DispatchStats> {
  const now = new Date();
  const runKey = `${now.toISOString().slice(0, 13)}`; // YYYY-MM-DDTHH
  if (!force) {
    const claimed = db
      .insert(jobRuns)
      .values({ job: "digest", runDate: runKey, startedAt: Date.now() })
      .onConflictDoNothing()
      .run();
    if (claimed.changes === 0) {
      return {
        skipped: true,
        sent: 0,
        failed: 0,
        usersConsidered: 0,
        quiet: 0,
        settled: 0,
      };
    }
  }

  const stats: DispatchStats = {
    skipped: false,
    sent: 0,
    failed: 0,
    usersConsidered: 0,
    quiet: 0,
    settled: 0,
  };

  const channelRows = db.select().from(notificationChannels).all();
  const userIds = [...new Set(channelRows.map((row) => row.userId))];
  if (userIds.length === 0) return stats;

  const userRows = db
    .select({ user: users, settings: userSettings })
    .from(users)
    .innerJoin(userSettings, eq(userSettings.userId, users.id))
    .where(inArray(users.id, userIds))
    .all();

  for (const { user, settings } of userRows) {
    const localHour = Number(
      new Intl.DateTimeFormat("en-GB", {
        hour: "2-digit",
        hour12: false,
        timeZone: settings.timezone,
      }).format(new TZDate(now, settings.timezone)),
    );
    // `>=`, not `==`: the hourly tick can miss a user's exact digest hour —
    // the container was restarting, the previous run overran, the host was
    // asleep. Requiring an exact match dropped that day's digest entirely.
    // Sending late is the better failure; the per-user/channel/local-day
    // dedupe below is what keeps it to one.
    if (!force && localHour < settings.digestHour) continue;
    stats.usersConsidered++;

    const localDate = today(settings.timezone);
    const digest = composeDigest(
      pendingDigestTasks(user.id, settings.locale),
      localDate,
    );
    if (!digest) {
      stats.quiet++;
      continue;
    }

    const enabled = channelRows.filter(
      (row) => row.userId === user.id && row.enabled,
    );
    for (const row of enabled) {
      const channel = channelRegistry[row.channel];
      if (!channel) {
        // A stored channel the registry no longer knows: that row can never
        // send again, and silence is how it stayed unnoticed.
        console.error(
          "[digest] unknown channel:",
          JSON.stringify({ userId: user.id, channel: row.channel }),
        );
        continue;
      }
      if (digestSettled(user.id, row.channel, localDate)) {
        stats.settled++;
        continue;
      }

      let status: "sent" | "failed" = "sent";
      let error: string | null = null;
      try {
        await channel.send(user, settings, digest, JSON.parse(row.config));
        stats.sent++;
      } catch (err) {
        status = "failed";
        error = err instanceof Error ? err.message : String(err);
        stats.failed++;
        // No recipient details (address/token) — just enough to diagnose
        // which channel/user is misconfigured without logging secrets.
        console.error(
          "[digest] send failed:",
          JSON.stringify({ userId: user.id, channel: row.channel, error }),
        );
      }
      db.insert(notificationLog)
        .values({
          userId: user.id,
          channel: row.channel,
          kind: "digest",
          digestDate: localDate,
          taskIds: JSON.stringify(digest.items.map((item) => item.id)),
          status,
          error,
          sentAt: Date.now(),
        })
        .run();
    }
  }

  if (!force) {
    db.update(jobRuns)
      .set({ finishedAt: Date.now(), detail: JSON.stringify(stats) })
      .where(and(eq(jobRuns.job, "digest"), eq(jobRuns.runDate, runKey)))
      .run();
  }
  return stats;
}
