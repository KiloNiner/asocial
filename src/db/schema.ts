import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const createdAt = () =>
  integer("created_at")
    .notNull()
    .$defaultFn(() => Date.now());

export const users = sqliteTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name").notNull(),
  role: text("role", { enum: ["admin", "user"] })
    .notNull()
    .default("user"),
  createdAt: createdAt(),
});

export const userSettings = sqliteTable("user_settings", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  locale: text("locale", { enum: ["en", "da", "sv", "tlh"] })
    .notNull()
    .default("en"),
  timezone: text("timezone").notNull().default("Europe/Copenhagen"),
  actionWindowDays: integer("action_window_days").notNull().default(7),
  jitterPct: integer("jitter_pct").notNull().default(25),
  digestHour: integer("digest_hour").notNull().default(8),
  defaultIntervalDays: integer("default_interval_days").notNull().default(30),
  theme: text("theme").notNull().default("auto"),
});

export const sessions = sqliteTable(
  "sessions",
  {
    // sha256 hex of the raw token; the raw token lives only in the cookie
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at").notNull(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const invites = sqliteTable("invites", {
  id: id(),
  tokenHash: text("token_hash").notNull().unique(),
  email: text("email"),
  createdBy: text("created_by")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: createdAt(),
  expiresAt: integer("expires_at").notNull(),
  usedBy: text("used_by").references(() => users.id, { onDelete: "set null" }),
  usedAt: integer("used_at"),
});

export const passwordResets = sqliteTable("password_resets", {
  id: id(),
  tokenHash: text("token_hash").notNull().unique(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdBy: text("created_by")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: createdAt(),
  expiresAt: integer("expires_at").notNull(),
  usedAt: integer("used_at"),
});

export const circles = sqliteTable(
  "circles",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color").notNull(),
    intervalDays: integer("interval_days").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [
    uniqueIndex("circles_user_name_uq").on(t.userId, t.name),
    index("circles_user_idx").on(t.userId),
  ],
);

export const friends = sqliteTable(
  "friends",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    notes: text("notes"),
    intervalOverrideDays: integer("interval_override_days"),
    autoschedule: integer("autoschedule", { mode: "boolean" })
      .notNull()
      .default(true),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    birthMonth: integer("birth_month"),
    birthDay: integer("birth_day"),
    birthYear: integer("birth_year"),
    createdAt: createdAt(),
  },
  (t) => [index("friends_user_idx").on(t.userId, t.archived)],
);

export const friendCircles = sqliteTable(
  "friend_circles",
  {
    friendId: text("friend_id")
      .notNull()
      .references(() => friends.id, { onDelete: "cascade" }),
    circleId: text("circle_id")
      .notNull()
      .references(() => circles.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.friendId, t.circleId] }),
    index("fc_circle_idx").on(t.circleId),
  ],
);

// Built-in types have userId NULL and i18n-keyed labels; custom types are
// per-user and carry their own label/emoji.
export const contactTypes = sqliteTable(
  "contact_types",
  {
    id: id(),
    userId: text("user_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    name: text("name"),
    emoji: text("emoji"),
    defaultWeight: integer("default_weight").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [index("contact_types_user_idx").on(t.userId)],
);

export const userContactPrefs = sqliteTable(
  "user_contact_prefs",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    contactTypeId: text("contact_type_id")
      .notNull()
      .references(() => contactTypes.id, { onDelete: "cascade" }),
    weight: integer("weight").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.contactTypeId] })],
);

export const circleContactPrefs = sqliteTable(
  "circle_contact_prefs",
  {
    circleId: text("circle_id")
      .notNull()
      .references(() => circles.id, { onDelete: "cascade" }),
    contactTypeId: text("contact_type_id")
      .notNull()
      .references(() => contactTypes.id, { onDelete: "cascade" }),
    weight: integer("weight").notNull(),
  },
  (t) => [primaryKey({ columns: [t.circleId, t.contactTypeId] })],
);

export const friendContactPrefs = sqliteTable(
  "friend_contact_prefs",
  {
    friendId: text("friend_id")
      .notNull()
      .references(() => friends.id, { onDelete: "cascade" }),
    contactTypeId: text("contact_type_id")
      .notNull()
      .references(() => contactTypes.id, { onDelete: "cascade" }),
    weight: integer("weight").notNull(),
  },
  (t) => [primaryKey({ columns: [t.friendId, t.contactTypeId] })],
);

export const tasks = sqliteTable(
  "tasks",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    friendId: text("friend_id")
      .notNull()
      .references(() => friends.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["contact", "birthday"] })
      .notNull()
      .default("contact"),
    suggestedTypeId: text("suggested_type_id")
      .notNull()
      .references(() => contactTypes.id),
    dueDate: text("due_date").notNull(), // YYYY-MM-DD, start of the action window
    windowDays: integer("window_days").notNull(),
    status: text("status", { enum: ["pending", "done", "skipped"] })
      .notNull()
      .default("pending"),
    origin: text("origin", { enum: ["auto", "manual"] }).notNull(),
    snoozeCount: integer("snooze_count").notNull().default(0),
    // No FK: interactions also points back at tasks and SQLite dislikes cycles.
    interactionId: text("interaction_id"),
    createdAt: createdAt(),
    completedAt: integer("completed_at"),
  },
  (t) => [
    index("tasks_user_status_due_idx").on(t.userId, t.status, t.dueDate),
    index("tasks_friend_status_idx").on(t.friendId, t.status),
  ],
);

export const interactions = sqliteTable(
  "interactions",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    friendId: text("friend_id")
      .notNull()
      .references(() => friends.id, { onDelete: "cascade" }),
    contactTypeId: text("contact_type_id")
      .notNull()
      .references(() => contactTypes.id),
    occurredOn: text("occurred_on").notNull(), // YYYY-MM-DD
    note: text("note"),
    taskId: text("task_id"),
    createdAt: createdAt(),
  },
  (t) => [
    index("interactions_friend_date_idx").on(t.friendId, t.occurredOn),
    index("interactions_user_idx").on(t.userId),
  ],
);

export const notificationChannels = sqliteTable(
  "notification_channels",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    channel: text("channel", { enum: ["pushover", "email"] }).notNull(),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    config: text("config").notNull().default("{}"),
  },
  (t) => [uniqueIndex("notif_channel_user_uq").on(t.userId, t.channel)],
);

export const notificationLog = sqliteTable(
  "notification_log",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    channel: text("channel").notNull(),
    kind: text("kind").notNull(),
    digestDate: text("digest_date").notNull(), // local YYYY-MM-DD the digest covers
    taskIds: text("task_ids").notNull().default("[]"),
    status: text("status", { enum: ["sent", "failed"] }).notNull(),
    error: text("error"),
    sentAt: integer("sent_at").notNull(),
  },
  (t) => [
    index("notif_dedupe_idx").on(t.userId, t.channel, t.kind, t.digestDate),
  ],
);

export const jobRuns = sqliteTable(
  "job_runs",
  {
    id: id(),
    job: text("job").notNull(),
    runDate: text("run_date").notNull(),
    startedAt: integer("started_at").notNull(),
    finishedAt: integer("finished_at"),
    detail: text("detail"),
  },
  (t) => [uniqueIndex("job_runs_job_date_uq").on(t.job, t.runDate)],
);

export const BUILTIN_CONTACT_TYPE_IDS = [
  "message",
  "call",
  "coffee",
  "activity",
  "visit_them",
  "host_visit",
  "congratulate",
] as const;

export type BuiltinContactTypeId = (typeof BUILTIN_CONTACT_TYPE_IDS)[number];

export type User = typeof users.$inferSelect;
export type UserSettings = typeof userSettings.$inferSelect;
export type Circle = typeof circles.$inferSelect;
export type Friend = typeof friends.$inferSelect;
export type ContactType = typeof contactTypes.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type Interaction = typeof interactions.$inferSelect;
export type NotificationChannelRow = typeof notificationChannels.$inferSelect;
