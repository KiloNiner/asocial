"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { tasks, type Task } from "@/db/schema";
import { getSettings, requireUser } from "@/lib/auth/current-user";
import * as q from "@/lib/db/queries";
import { today } from "@/lib/scheduler/clock";
import { addDays } from "@/lib/scheduler/dates";
import { pendingTask, scheduleNextTask } from "@/lib/scheduler/schedule";

export type TaskFormState = { error?: string };

function getTask(userId: string, taskId: string): Task | null {
  return (
    db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
      .get() ?? null
  );
}

function revalidate() {
  revalidatePath("/[locale]", "page");
  revalidatePath("/[locale]/calendar", "page");
  revalidatePath("/[locale]/friends", "layout");
}

const completeSchema = z.object({
  contactTypeId: z.string().min(1),
  occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z
    .string()
    .max(10000)
    .optional()
    .transform((v) => (v?.trim() ? v.trim() : null)),
});

/**
 * Complete a task: journal the actual interaction (possibly a different
 * type than suggested) and, for contact tasks with autoschedule on, chain
 * the next one from the completion date. Birthday tasks never reset the
 * regular cadence.
 */
export async function completeTask(
  taskId: string,
  _prev: TaskFormState,
  formData: FormData,
): Promise<TaskFormState> {
  const user = await requireUser();
  const parsed = completeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };

  const task = getTask(user.id, taskId);
  if (!task || task.status !== "pending") return { error: "gone" };

  const interaction = q.createInteraction(user.id, {
    friendId: task.friendId,
    contactTypeId: parsed.data.contactTypeId,
    occurredOn: parsed.data.occurredOn,
    note: parsed.data.note,
    taskId: task.id,
  });
  db.update(tasks)
    .set({
      status: "done",
      interactionId: interaction.id,
      completedAt: Date.now(),
    })
    .where(eq(tasks.id, task.id))
    .run();

  if (task.kind === "contact") {
    const friend = q.getFriend(user.id, task.friendId);
    if (friend?.autoschedule) {
      scheduleNextTask(user.id, task.friendId, parsed.data.occurredOn);
    }
  }
  revalidate();
  return {};
}

/** Snooze: move the window without guilt; the task stays pending. */
export async function snoozeTask(taskId: string, days: number): Promise<void> {
  const user = await requireUser();
  const task = getTask(user.id, taskId);
  if (!task || task.status !== "pending") return;
  const settings = await getSettings(user.id);
  const clampedDays = Math.min(Math.max(Math.round(days), 1), 90);

  db.update(tasks)
    .set({
      dueDate: addDays(today(settings.timezone), clampedDays),
      snoozeCount: task.snoozeCount + 1,
    })
    .where(eq(tasks.id, task.id))
    .run();
  revalidate();
}

/** Skip: resolve without contact; autoschedule restarts a full interval. */
export async function skipTask(taskId: string): Promise<void> {
  const user = await requireUser();
  const task = getTask(user.id, taskId);
  if (!task || task.status !== "pending") return;

  db.update(tasks)
    .set({ status: "skipped", completedAt: Date.now() })
    .where(eq(tasks.id, task.id))
    .run();

  if (task.kind === "contact") {
    const friend = q.getFriend(user.id, task.friendId);
    const settings = await getSettings(user.id);
    if (friend?.autoschedule) {
      scheduleNextTask(user.id, task.friendId, today(settings.timezone));
    }
  }
  revalidate();
}

const manualSchema = z.object({
  friendId: z.string().min(1),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  contactTypeId: z.string().optional(),
});

/** Manually plan the next contact; replaces any pending auto task. */
export async function createManualTask(
  _prev: TaskFormState,
  formData: FormData,
): Promise<TaskFormState> {
  const user = await requireUser();
  const parsed = manualSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };
  const { friendId, dueDate, contactTypeId } = parsed.data;
  if (!q.getFriend(user.id, friendId)) return { error: "invalid" };

  const settings = await getSettings(user.id);
  const existing = pendingTask(user.id, friendId, "contact");
  if (existing) {
    db.delete(tasks).where(eq(tasks.id, existing.id)).run();
  }

  if (contactTypeId) {
    db.insert(tasks)
      .values({
        userId: user.id,
        friendId,
        kind: "contact",
        suggestedTypeId: contactTypeId,
        dueDate,
        windowDays: settings.actionWindowDays,
        status: "pending",
        origin: "manual",
      })
      .run();
  } else {
    // No type chosen: let the picker suggest one, then pin the chosen date.
    const created = scheduleNextTask(user.id, friendId, dueDate, {
      origin: "manual",
    });
    if (!created) return { error: "invalid" };
    db.update(tasks)
      .set({ dueDate })
      .where(eq(tasks.id, created.id))
      .run();
  }
  revalidate();
  return {};
}

/** Move a pending task to a specific date. */
export async function rescheduleTask(
  taskId: string,
  dueDate: string,
): Promise<void> {
  const user = await requireUser();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return;
  const task = getTask(user.id, taskId);
  if (!task || task.status !== "pending") return;
  db.update(tasks).set({ dueDate }).where(eq(tasks.id, task.id)).run();
  revalidate();
}
