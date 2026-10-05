import { eq } from "drizzle-orm";
import { db } from "@/db";
import { calendarFeeds } from "@/db/schema";
import { generateToken } from "./tokens";

// The feed token is the whole credential for a read-only .ics feed, so it is
// a full 256-bit random value. It is stored raw rather than hashed so the URL
// can be shown again on the calendar page; rotating it is the revocation path.

export function getCalendarFeedToken(userId: string): string | null {
  return (
    db
      .select({ token: calendarFeeds.token })
      .from(calendarFeeds)
      .where(eq(calendarFeeds.userId, userId))
      .get()?.token ?? null
  );
}

/** Creates the feed, or replaces its token so every old URL stops working. */
export function rotateCalendarFeedToken(userId: string): string {
  const token = generateToken();
  db.insert(calendarFeeds)
    .values({ userId, token })
    .onConflictDoUpdate({
      target: calendarFeeds.userId,
      set: { token, createdAt: Date.now() },
    })
    .run();
  return token;
}

export function deleteCalendarFeed(userId: string): void {
  db.delete(calendarFeeds).where(eq(calendarFeeds.userId, userId)).run();
}

/** The owner of a feed token, or null for an unknown/rotated one. */
export function findCalendarFeedUser(token: string): string | null {
  return (
    db
      .select({ userId: calendarFeeds.userId })
      .from(calendarFeeds)
      .where(eq(calendarFeeds.token, token))
      .get()?.userId ?? null
  );
}
