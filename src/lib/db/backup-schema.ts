import { z } from "zod";
import { isValidBirthday } from "@/lib/validation/birthday";
import { isSingleEmoji } from "@/lib/validation/emoji";
import { isThemeChoice } from "@/lib/themes";
import { BACKUP_VERSION } from "./queries";

/**
 * Per-table row schemas for backup restore. These mirror the value bounds
 * enforced by the corresponding create/update server actions (circles.ts,
 * friends.ts, contact-types.ts, interactions.ts, settings.ts's prefSchema) —
 * keep them in sync if those bounds ever change. Restore must not be a
 * back door around the constraints normal mutation already enforces.
 */

const circleRowSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(60),
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
  intervalDays: z.number().int().min(1).max(730),
  sortOrder: z.number().int(),
});

const friendRowSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().trim().min(1).max(100),
    notes: z.string().max(5000).nullable(),
    intervalOverrideDays: z.number().int().min(1).max(730).nullable(),
    autoschedule: z.boolean(),
    archived: z.boolean(),
    birthMonth: z.number().int().min(1).max(12).nullable(),
    birthDay: z.number().int().min(1).max(31).nullable(),
    birthYear: z.number().int().min(1900).max(2100).nullable(),
    createdAt: z.number().int(),
  })
  .refine((row) => (row.birthMonth === null) === (row.birthDay === null), {
    message: "birthMonth and birthDay must both be set or both be null",
    path: ["birthDay"],
  })
  .refine(
    (row) =>
      row.birthMonth === null ||
      row.birthDay === null ||
      isValidBirthday(row.birthMonth, row.birthDay),
    {
      message: "birthMonth/birthDay must be a date that exists",
      path: ["birthDay"],
    },
  )
  .refine(
    (row) =>
      row.birthYear === null ||
      (row.birthMonth !== null && row.birthDay !== null),
    {
      message: "birthYear requires birthMonth and birthDay",
      path: ["birthYear"],
    },
  );

const friendCircleRowSchema = z.object({
  friendId: z.string().min(1),
  circleId: z.string().min(1),
});

const contactTypeRowSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(60),
  emoji: z.string().refine(isSingleEmoji).nullable(),
  defaultWeight: z.number().int().min(0).max(100),
  sortOrder: z.number().int(),
  archived: z.boolean(),
});

const userContactPrefRowSchema = z.object({
  contactTypeId: z.string().min(1),
  weight: z.number().int().min(0).max(100),
});

const circleContactPrefRowSchema = z.object({
  circleId: z.string().min(1),
  contactTypeId: z.string().min(1),
  weight: z.number().int().min(0).max(100),
});

const friendContactPrefRowSchema = z.object({
  friendId: z.string().min(1),
  contactTypeId: z.string().min(1),
  weight: z.number().int().min(0).max(100),
});

const interactionRowSchema = z.object({
  id: z.string().min(1),
  friendId: z.string().min(1),
  contactTypeId: z.string().min(1),
  occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().max(10000).nullable(),
  taskId: z.string().nullable(),
  createdAt: z.number().int(),
});

/**
 * Settings are restored alongside the data they configure — an interval or a
 * jitter percentage means little without the circles it applies to. Bounds
 * mirror settings.ts (profileSchema, schedulingSchema, updateTheme's
 * isThemeChoice). Account identity (email, display name, password) is
 * deliberately absent from a backup: these are preferences, not credentials.
 */
const settingsRowSchema = z.object({
  locale: z.enum(["en", "da", "sv", "tlh"]),
  timezone: z.string().min(1).max(60),
  actionWindowDays: z.number().int().min(1).max(30),
  jitterPct: z.number().int().min(0).max(50),
  digestHour: z.number().int().min(0).max(23),
  defaultIntervalDays: z.number().int().min(1).max(730),
  theme: z.string().refine(isThemeChoice),
});

/** Unambiguous composite key for a pair of client-supplied ids. */
function pairKey(a: string, b: string): string {
  return JSON.stringify([a, b]);
}

/** True when no two rows share the same key. */
function allDistinct<T>(rows: T[], key: (row: T) => string): boolean {
  return new Set(rows.map(key)).size === rows.length;
}

const baseBackupSchema = z.object({
  exportedAt: z.string(),
  circles: z.array(circleRowSchema),
  friends: z.array(friendRowSchema),
  friendCircles: z.array(friendCircleRowSchema),
  contactTypes: z.array(contactTypeRowSchema),
  userContactPrefs: z.array(userContactPrefRowSchema),
  circleContactPrefs: z.array(circleContactPrefRowSchema),
  friendContactPrefs: z.array(friendContactPrefRowSchema),
  interactions: z.array(interactionRowSchema),
});

/**
 * File-level self-consistency, checked before anything touches the DB.
 *
 * Every rule here stands in for a UNIQUE index or composite primary key the
 * INSERT would otherwise hit: a hand-edited file that duplicated a circle name
 * or an id used to reach importUserData() and abort mid-transaction with a raw
 * SQLite error, which surfaced as a crashed server action rather than a "that
 * file isn't valid" message. Duplicate *ids* deserve special mention: restore
 * mints one fresh id per distinct old id, so two rows sharing an id collapse
 * onto the same new id and collide on the primary key.
 */
function checkConsistency(
  data: z.infer<typeof baseBackupSchema>,
  ctx: z.RefinementCtx,
): void {
  const rules: [boolean, string, string][] = [
    [allDistinct(data.circles, (r) => r.id), "circles", "duplicate circle id"],
    [
      allDistinct(data.circles, (r) => r.name.trim()),
      "circles",
      "duplicate circle name",
    ],
    [allDistinct(data.friends, (r) => r.id), "friends", "duplicate friend id"],
    [
      allDistinct(data.contactTypes, (r) => r.id),
      "contactTypes",
      "duplicate contact type id",
    ],
    [
      allDistinct(data.interactions, (r) => r.id),
      "interactions",
      "duplicate interaction id",
    ],
    [
      allDistinct(data.friendCircles, (r) => pairKey(r.friendId, r.circleId)),
      "friendCircles",
      "duplicate friend/circle pair",
    ],
    [
      allDistinct(data.userContactPrefs, (r) => r.contactTypeId),
      "userContactPrefs",
      "duplicate contact type preference",
    ],
    [
      allDistinct(data.circleContactPrefs, (r) => pairKey(r.circleId, r.contactTypeId)),
      "circleContactPrefs",
      "duplicate circle/contact type preference",
    ],
    [
      allDistinct(data.friendContactPrefs, (r) => pairKey(r.friendId, r.contactTypeId)),
      "friendContactPrefs",
      "duplicate friend/contact type preference",
    ],
  ];
  for (const [ok, path, message] of rules) {
    if (!ok) ctx.addIssue({ code: "custom", message, path: [path] });
  }
}

/**
 * Version 1 files predate `settings` and simply don't carry it; they restore
 * with the account's current settings left alone. Old exports stay restorable
 * — a format bump that invalidates last year's backup isn't much of a backup.
 */
export const backupSchema = baseBackupSchema
  .extend({
    version: z.union([z.literal(1), z.literal(BACKUP_VERSION)]),
    settings: settingsRowSchema.nullish().transform((v) => v ?? null),
  })
  .superRefine(checkConsistency);
