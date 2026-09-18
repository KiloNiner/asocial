import { and, isNotNull, isNull, lt, or } from "drizzle-orm";
import { db } from "@/db";
import {
  invites,
  jobRuns,
  notificationLog,
  passwordResets,
  sessions,
} from "@/db/schema";

/**
 * Housekeeping for the tables that only ever grow.
 *
 * Nothing in the app deleted these: expired sessions were dropped only if
 * their own token showed up again (an abandoned one never does), spent
 * invites and reset tokens stayed forever, and the job/notification logs
 * gained a row per run for the life of the install. None of it is large on
 * its own — this is a single-container app, not a fleet — but it is all
 * unbounded, and the auth leftovers are credential-adjacent rows kept long
 * after they can do anything but leak.
 *
 * Unlike the rest of `db/`, these are cross-user maintenance deletes, so they
 * are not scoped by userId and do not belong in `queries.ts`.
 */

/** Dead auth tokens: long enough for an admin to still see what happened. */
const TOKEN_RETENTION_DAYS = 30;

/** Operational history. Enough to explain "why no digest last month?". */
const LOG_RETENTION_DAYS = 90;

const DAY_MS = 24 * 60 * 60 * 1000;

export type PruneStats = {
  sessions: number;
  invites: number;
  passwordResets: number;
  jobRuns: number;
  notificationLog: number;
};

export const emptyPruneStats = (): PruneStats => ({
  sessions: 0,
  invites: 0,
  passwordResets: 0,
  jobRuns: 0,
  notificationLog: 0,
});

/**
 * Delete aged-out rows. Returns how many went, per table.
 *
 * Deliberately not transactional: each delete is independent, and a partial
 * sweep is fine — tomorrow's run picks up whatever was missed.
 */
export function pruneExpiredData(now = Date.now()): PruneStats {
  const tokenCutoff = now - TOKEN_RETENTION_DAYS * DAY_MS;
  const logCutoff = now - LOG_RETENTION_DAYS * DAY_MS;

  // Expired sessions go immediately: a dead token hash has no audit value,
  // and validateSession() would reject it anyway.
  const sessionsDeleted = db
    .delete(sessions)
    .where(lt(sessions.expiresAt, now))
    .run();

  // Spent or long-expired invites. `usedAt` and `expiresAt` are independent:
  // an invite used the day it was minted is done with, but so is one that was
  // never redeemed. The admin invite list loses nothing it still acts on.
  const invitesDeleted = db
    .delete(invites)
    .where(
      or(
        and(isNotNull(invites.usedAt), lt(invites.usedAt, tokenCutoff)),
        and(isNull(invites.usedAt), lt(invites.expiresAt, tokenCutoff)),
      ),
    )
    .run();

  const resetsDeleted = db
    .delete(passwordResets)
    .where(
      or(
        and(
          isNotNull(passwordResets.usedAt),
          lt(passwordResets.usedAt, tokenCutoff),
        ),
        and(
          isNull(passwordResets.usedAt),
          lt(passwordResets.expiresAt, tokenCutoff),
        ),
      ),
    )
    .run();

  // Only finished runs: an unfinished row older than the cutoff would mean a
  // crash nobody noticed, and that is worth keeping around to find.
  const jobRunsDeleted = db
    .delete(jobRuns)
    .where(and(isNotNull(jobRuns.finishedAt), lt(jobRuns.finishedAt, logCutoff)))
    .run();

  // Safe against the digest dedupe, which only ever looks at today's date.
  const notificationsDeleted = db
    .delete(notificationLog)
    .where(lt(notificationLog.sentAt, logCutoff))
    .run();

  return {
    sessions: sessionsDeleted.changes,
    invites: invitesDeleted.changes,
    passwordResets: resetsDeleted.changes,
    jobRuns: jobRunsDeleted.changes,
    notificationLog: notificationsDeleted.changes,
  };
}
