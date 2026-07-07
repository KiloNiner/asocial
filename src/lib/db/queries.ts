/**
 * User-scoped data access. Every function takes the owning userId and filters
 * by it — UI code and server actions must go through this module (or the
 * scheduler) instead of importing `db` directly, so per-user isolation stays
 * grep-ably enforced in one place.
 */
import { and, asc, desc, eq, inArray, isNotNull, isNull, max, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  circleContactPrefs,
  circles,
  contactTypes,
  friendCircles,
  friendContactPrefs,
  friends,
  interactions,
  notificationChannels,
  notificationLog,
  tasks,
  userContactPrefs,
  type Circle,
  type ContactType,
  type Friend,
  type Interaction,
  type Task,
} from "@/db/schema";

// ---------- circles ----------

export function listCircles(userId: string): Circle[] {
  return db
    .select()
    .from(circles)
    .where(eq(circles.userId, userId))
    .orderBy(asc(circles.sortOrder), asc(circles.name))
    .all();
}

export function getCircle(userId: string, circleId: string): Circle | null {
  return (
    db
      .select()
      .from(circles)
      .where(and(eq(circles.id, circleId), eq(circles.userId, userId)))
      .get() ?? null
  );
}

export function circleMemberCounts(userId: string): Map<string, number> {
  const rows = db
    .select({ circleId: friendCircles.circleId, n: sql<number>`count(*)` })
    .from(friendCircles)
    .innerJoin(circles, eq(friendCircles.circleId, circles.id))
    .innerJoin(friends, eq(friendCircles.friendId, friends.id))
    .where(and(eq(circles.userId, userId), eq(friends.archived, false)))
    .groupBy(friendCircles.circleId)
    .all();
  return new Map(rows.map((r) => [r.circleId, r.n]));
}

export function createCircle(
  userId: string,
  data: { name: string; color: string; intervalDays: number },
): Circle {
  return db
    .insert(circles)
    .values({ ...data, userId })
    .returning()
    .get();
}

export function updateCircle(
  userId: string,
  circleId: string,
  data: Partial<{ name: string; color: string; intervalDays: number }>,
): void {
  db.update(circles)
    .set(data)
    .where(and(eq(circles.id, circleId), eq(circles.userId, userId)))
    .run();
}

export function deleteCircle(userId: string, circleId: string): void {
  db.delete(circles)
    .where(and(eq(circles.id, circleId), eq(circles.userId, userId)))
    .run();
}

export function getCirclePrefs(
  userId: string,
  circleId: string,
): Map<string, number> {
  const rows = db
    .select({
      contactTypeId: circleContactPrefs.contactTypeId,
      weight: circleContactPrefs.weight,
    })
    .from(circleContactPrefs)
    .innerJoin(circles, eq(circleContactPrefs.circleId, circles.id))
    .where(and(eq(circles.id, circleId), eq(circles.userId, userId)))
    .all();
  return new Map(rows.map((r) => [r.contactTypeId, r.weight]));
}

export function setCirclePref(
  userId: string,
  circleId: string,
  contactTypeId: string,
  weight: number | null,
): void {
  if (!getCircle(userId, circleId)) return;
  if (weight === null) {
    db.delete(circleContactPrefs)
      .where(
        and(
          eq(circleContactPrefs.circleId, circleId),
          eq(circleContactPrefs.contactTypeId, contactTypeId),
        ),
      )
      .run();
    return;
  }
  db.insert(circleContactPrefs)
    .values({ circleId, contactTypeId, weight })
    .onConflictDoUpdate({
      target: [circleContactPrefs.circleId, circleContactPrefs.contactTypeId],
      set: { weight },
    })
    .run();
}

// ---------- contact types ----------

/** Built-in types plus the user's own custom types. */
export function listContactTypes(
  userId: string,
  opts: { includeArchived?: boolean } = {},
): ContactType[] {
  const scope = or(isNull(contactTypes.userId), eq(contactTypes.userId, userId));
  return db
    .select()
    .from(contactTypes)
    .where(
      opts.includeArchived
        ? scope
        : and(scope, eq(contactTypes.archived, false)),
    )
    .orderBy(asc(contactTypes.sortOrder))
    .all();
}

export function createCustomContactType(
  userId: string,
  data: { name: string; emoji: string; defaultWeight: number },
): ContactType {
  const maxSort =
    db
      .select({ m: max(contactTypes.sortOrder) })
      .from(contactTypes)
      .get()?.m ?? 0;
  return db
    .insert(contactTypes)
    .values({ ...data, userId, sortOrder: maxSort + 1 })
    .returning()
    .get();
}

/** Archive (never delete — historical interactions reference the type). */
export function setContactTypeArchived(
  userId: string,
  typeId: string,
  archived: boolean,
): void {
  db.update(contactTypes)
    .set({ archived })
    .where(and(eq(contactTypes.id, typeId), eq(contactTypes.userId, userId)))
    .run();
}

export function getUserPrefs(userId: string): Map<string, number> {
  const rows = db
    .select()
    .from(userContactPrefs)
    .where(eq(userContactPrefs.userId, userId))
    .all();
  return new Map(rows.map((r) => [r.contactTypeId, r.weight]));
}

export function setUserPref(
  userId: string,
  contactTypeId: string,
  weight: number | null,
): void {
  if (weight === null) {
    db.delete(userContactPrefs)
      .where(
        and(
          eq(userContactPrefs.userId, userId),
          eq(userContactPrefs.contactTypeId, contactTypeId),
        ),
      )
      .run();
    return;
  }
  db.insert(userContactPrefs)
    .values({ userId, contactTypeId, weight })
    .onConflictDoUpdate({
      target: [userContactPrefs.userId, userContactPrefs.contactTypeId],
      set: { weight },
    })
    .run();
}

// ---------- friends ----------

export type FriendListEntry = {
  friend: Friend;
  circles: Circle[];
  lastContact: string | null; // YYYY-MM-DD
  nextTask: Task | null;
};

export function getFriend(userId: string, friendId: string): Friend | null {
  return (
    db
      .select()
      .from(friends)
      .where(and(eq(friends.id, friendId), eq(friends.userId, userId)))
      .get() ?? null
  );
}

export function listFriends(
  userId: string,
  opts: { includeArchived?: boolean } = {},
): FriendListEntry[] {
  const friendRows = db
    .select()
    .from(friends)
    .where(
      opts.includeArchived
        ? eq(friends.userId, userId)
        : and(eq(friends.userId, userId), eq(friends.archived, false)),
    )
    .orderBy(asc(friends.name))
    .all();
  if (friendRows.length === 0) return [];
  const ids = friendRows.map((f) => f.id);

  const circleRows = db
    .select({ friendId: friendCircles.friendId, circle: circles })
    .from(friendCircles)
    .innerJoin(circles, eq(friendCircles.circleId, circles.id))
    .where(inArray(friendCircles.friendId, ids))
    .orderBy(asc(circles.sortOrder))
    .all();

  const lastContactRows = db
    .select({
      friendId: interactions.friendId,
      last: max(interactions.occurredOn),
    })
    .from(interactions)
    .where(inArray(interactions.friendId, ids))
    .groupBy(interactions.friendId)
    .all();

  const pendingTasks = db
    .select()
    .from(tasks)
    .where(and(inArray(tasks.friendId, ids), eq(tasks.status, "pending")))
    .orderBy(asc(tasks.dueDate))
    .all();

  const circlesByFriend = new Map<string, Circle[]>();
  for (const row of circleRows) {
    const list = circlesByFriend.get(row.friendId) ?? [];
    list.push(row.circle);
    circlesByFriend.set(row.friendId, list);
  }
  const lastByFriend = new Map(
    lastContactRows.map((r) => [r.friendId, r.last]),
  );
  const taskByFriend = new Map<string, Task>();
  for (const task of pendingTasks) {
    // earliest pending task per friend (contact task preferred by sort order)
    if (!taskByFriend.has(task.friendId)) taskByFriend.set(task.friendId, task);
  }

  return friendRows.map((friend) => ({
    friend,
    circles: circlesByFriend.get(friend.id) ?? [],
    lastContact: lastByFriend.get(friend.id) ?? null,
    nextTask: taskByFriend.get(friend.id) ?? null,
  }));
}

export function getFriendCircles(userId: string, friendId: string): Circle[] {
  return db
    .select({ circle: circles })
    .from(friendCircles)
    .innerJoin(circles, eq(friendCircles.circleId, circles.id))
    .where(
      and(eq(friendCircles.friendId, friendId), eq(circles.userId, userId)),
    )
    .orderBy(asc(circles.sortOrder))
    .all()
    .map((r) => r.circle);
}

export type FriendInput = {
  name: string;
  notes: string | null;
  intervalOverrideDays: number | null;
  autoschedule: boolean;
  birthMonth: number | null;
  birthDay: number | null;
  birthYear: number | null;
  circleIds: string[];
};

export function createFriend(userId: string, input: FriendInput): Friend {
  const { circleIds, ...data } = input;
  return db.transaction((tx) => {
    const friend = tx
      .insert(friends)
      .values({ ...data, userId })
      .returning()
      .get();
    setFriendCirclesTx(tx, userId, friend.id, circleIds);
    return friend;
  });
}

export function updateFriend(
  userId: string,
  friendId: string,
  input: FriendInput,
): void {
  const { circleIds, ...data } = input;
  db.transaction((tx) => {
    tx.update(friends)
      .set(data)
      .where(and(eq(friends.id, friendId), eq(friends.userId, userId)))
      .run();
    setFriendCirclesTx(tx, userId, friendId, circleIds);
  });
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

function setFriendCirclesTx(
  tx: Tx,
  userId: string,
  friendId: string,
  circleIds: string[],
): void {
  const owned = tx
    .select({ id: circles.id })
    .from(circles)
    .where(eq(circles.userId, userId))
    .all()
    .map((r) => r.id);
  const valid = circleIds.filter((id) => owned.includes(id));
  tx.delete(friendCircles).where(eq(friendCircles.friendId, friendId)).run();
  if (valid.length > 0) {
    tx.insert(friendCircles)
      .values(valid.map((circleId) => ({ friendId, circleId })))
      .run();
  }
}

export function setFriendArchived(
  userId: string,
  friendId: string,
  archived: boolean,
): void {
  db.transaction((tx) => {
    tx.update(friends)
      .set({ archived })
      .where(and(eq(friends.id, friendId), eq(friends.userId, userId)))
      .run();
    if (archived) {
      // Cancel pending nudges; skipped state keeps history without guilt.
      tx.update(tasks)
        .set({ status: "skipped" })
        .where(and(eq(tasks.friendId, friendId), eq(tasks.status, "pending")))
        .run();
    }
  });
}

export function getFriendPrefs(
  userId: string,
  friendId: string,
): Map<string, number> {
  const rows = db
    .select({
      contactTypeId: friendContactPrefs.contactTypeId,
      weight: friendContactPrefs.weight,
    })
    .from(friendContactPrefs)
    .innerJoin(friends, eq(friendContactPrefs.friendId, friends.id))
    .where(and(eq(friends.id, friendId), eq(friends.userId, userId)))
    .all();
  return new Map(rows.map((r) => [r.contactTypeId, r.weight]));
}

export function setFriendPref(
  userId: string,
  friendId: string,
  contactTypeId: string,
  weight: number | null,
): void {
  if (!getFriend(userId, friendId)) return;
  if (weight === null) {
    db.delete(friendContactPrefs)
      .where(
        and(
          eq(friendContactPrefs.friendId, friendId),
          eq(friendContactPrefs.contactTypeId, contactTypeId),
        ),
      )
      .run();
    return;
  }
  db.insert(friendContactPrefs)
    .values({ friendId, contactTypeId, weight })
    .onConflictDoUpdate({
      target: [friendContactPrefs.friendId, friendContactPrefs.contactTypeId],
      set: { weight },
    })
    .run();
}

// ---------- interactions (journal) ----------

export function listInteractions(
  userId: string,
  friendId: string,
): Interaction[] {
  return db
    .select()
    .from(interactions)
    .where(
      and(
        eq(interactions.friendId, friendId),
        eq(interactions.userId, userId),
      ),
    )
    .orderBy(desc(interactions.occurredOn), desc(interactions.createdAt))
    .all();
}

export function createInteraction(
  userId: string,
  data: {
    friendId: string;
    contactTypeId: string;
    occurredOn: string;
    note: string | null;
    taskId?: string | null;
  },
): Interaction {
  return db
    .insert(interactions)
    .values({ ...data, userId })
    .returning()
    .get();
}

export function updateInteraction(
  userId: string,
  interactionId: string,
  data: { contactTypeId: string; occurredOn: string; note: string | null },
): void {
  db.update(interactions)
    .set(data)
    .where(
      and(
        eq(interactions.id, interactionId),
        eq(interactions.userId, userId),
      ),
    )
    .run();
}

export function deleteInteraction(userId: string, interactionId: string): void {
  db.delete(interactions)
    .where(
      and(
        eq(interactions.id, interactionId),
        eq(interactions.userId, userId),
      ),
    )
    .run();
}

// ---------- views (dashboard board + calendar) ----------

export type BoardRow = {
  friend: Friend;
  /** Color of the governing (most frequent) circle, if any. */
  color: string | null;
  contactTask: Task | null;
  birthdayTask: Task | null;
};

/** One row per friend with at least one pending task, plus circle color. */
export function boardRows(userId: string): BoardRow[] {
  const pending = db
    .select()
    .from(tasks)
    .where(and(eq(tasks.userId, userId), eq(tasks.status, "pending")))
    .orderBy(asc(tasks.dueDate))
    .all();
  if (pending.length === 0) return [];

  const byFriend = new Map<string, { contact?: Task; birthday?: Task }>();
  for (const task of pending) {
    const entry = byFriend.get(task.friendId) ?? {};
    if (task.kind === "contact" && !entry.contact) entry.contact = task;
    if (task.kind === "birthday" && !entry.birthday) entry.birthday = task;
    byFriend.set(task.friendId, entry);
  }

  const friendRows = db
    .select()
    .from(friends)
    .where(
      and(
        eq(friends.userId, userId),
        eq(friends.archived, false),
        inArray(friends.id, [...byFriend.keys()]),
      ),
    )
    .all();

  const circleRows = db
    .select({ friendId: friendCircles.friendId, circle: circles })
    .from(friendCircles)
    .innerJoin(circles, eq(friendCircles.circleId, circles.id))
    .where(inArray(friendCircles.friendId, [...byFriend.keys()]))
    .all();
  const circlesByFriend = new Map<string, Circle[]>();
  for (const row of circleRows) {
    const list = circlesByFriend.get(row.friendId) ?? [];
    list.push(row.circle);
    circlesByFriend.set(row.friendId, list);
  }

  const rows: BoardRow[] = friendRows.map((friend) => {
    const friendCirclesList = circlesByFriend.get(friend.id) ?? [];
    const governing =
      friendCirclesList.length > 0
        ? friendCirclesList.reduce((a, b) =>
            b.intervalDays < a.intervalDays ? b : a,
          )
        : null;
    const entry = byFriend.get(friend.id)!;
    return {
      friend,
      color: governing?.color ?? null,
      contactTask: entry.contact ?? null,
      birthdayTask: entry.birthday ?? null,
    };
  });

  // Urgency order: earliest actionable date first.
  const urgency = (row: BoardRow): string => {
    const dates = [row.contactTask?.dueDate, row.birthdayTask?.dueDate].filter(
      (d): d is string => !!d,
    );
    return dates.sort()[0] ?? "9999-12-31";
  };
  return rows.sort((a, b) => urgency(a).localeCompare(urgency(b)));
}

export type BirthdayEntry = {
  friendId: string;
  name: string;
  birthDay: number;
  birthMonth: number;
  birthYear: number | null;
};

/** All active friends with a birthday set (for calendar cake chips). */
export function listBirthdays(userId: string): BirthdayEntry[] {
  return db
    .select({
      friendId: friends.id,
      name: friends.name,
      birthDay: friends.birthDay,
      birthMonth: friends.birthMonth,
      birthYear: friends.birthYear,
    })
    .from(friends)
    .where(
      and(
        eq(friends.userId, userId),
        eq(friends.archived, false),
        isNotNull(friends.birthDay),
        isNotNull(friends.birthMonth),
      ),
    )
    .all() as BirthdayEntry[];
}

/** Pending tasks joined with friend names (calendar chips). */
export function listPendingTasksWithNames(
  userId: string,
): { task: Task; friendName: string; color: string | null }[] {
  const rows = db
    .select({ task: tasks, friendName: friends.name })
    .from(tasks)
    .innerJoin(friends, eq(tasks.friendId, friends.id))
    .where(and(eq(tasks.userId, userId), eq(tasks.status, "pending")))
    .orderBy(asc(tasks.dueDate))
    .all();
  const board = boardRows(userId);
  const colorByFriend = new Map(board.map((r) => [r.friend.id, r.color]));
  return rows.map((row) => ({
    ...row,
    color: colorByFriend.get(row.task.friendId) ?? null,
  }));
}

// ---------- notifications (settings UI) ----------

export function getNotificationChannels(
  userId: string,
): Map<string, { enabled: boolean; config: Record<string, string> }> {
  const rows = db
    .select()
    .from(notificationChannels)
    .where(eq(notificationChannels.userId, userId))
    .all();
  return new Map(
    rows.map((row) => [
      row.channel,
      { enabled: row.enabled, config: JSON.parse(row.config) },
    ]),
  );
}

export function listNotificationLog(
  userId: string,
  limit = 10,
): (typeof notificationLog.$inferSelect)[] {
  return db
    .select()
    .from(notificationLog)
    .where(eq(notificationLog.userId, userId))
    .orderBy(desc(notificationLog.sentAt))
    .limit(limit)
    .all();
}
