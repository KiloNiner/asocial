import { z } from "zod";
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
      row.birthYear === null || (row.birthMonth !== null && row.birthDay !== null),
    { message: "birthYear requires birthMonth and birthDay", path: ["birthYear"] },
  );

const friendCircleRowSchema = z.object({
  friendId: z.string().min(1),
  circleId: z.string().min(1),
});

const contactTypeRowSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(60),
  emoji: z.string().trim().min(1).max(8),
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

export const backupSchema = z.object({
  version: z.literal(BACKUP_VERSION),
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
