"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { tasks } from "@/db/schema";
import { getSettings, requireUser } from "@/lib/auth/current-user";
import * as q from "@/lib/db/queries";
import { addDays } from "@/lib/scheduler/dates";
import { effectiveInterval } from "@/lib/scheduler/interval";
import { pendingTask, scheduleNextTask } from "@/lib/scheduler/schedule";

export type InteractionFormState = { error?: string };

const interactionSchema = z.object({
  friendId: z.string().min(1),
  contactTypeId: z.string().min(1),
  occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z
    .string()
    .max(10000)
    .optional()
    .transform((v) => (v?.trim() ? v.trim() : null)),
});

function revalidate(friendId: string) {
  revalidatePath(`/[locale]/friends/${friendId}`, "page");
  revalidatePath("/[locale]/friends", "page");
}

export async function logInteraction(
  _prev: InteractionFormState,
  formData: FormData,
): Promise<InteractionFormState> {
  const user = await requireUser();
  const parsed = interactionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };
  const friend = q.getFriend(user.id, parsed.data.friendId);
  if (!friend) return { error: "invalid" };

  const interaction = q.createInteraction(user.id, parsed.data);

  // A logged contact close to a pending nudge satisfies that nudge: within
  // half an effective interval before its due date (or any time after).
  const open = pendingTask(user.id, friend.id, "contact");
  if (open) {
    const settings = await getSettings(user.id);
    const interval = effectiveInterval(
      friend,
      q.getFriendCircles(user.id, friend.id),
      settings,
    );
    const satisfiesFrom = addDays(open.dueDate, -Math.ceil(interval.days / 2));
    if (parsed.data.occurredOn >= satisfiesFrom) {
      db.update(tasks)
        .set({
          status: "done",
          interactionId: interaction.id,
          completedAt: Date.now(),
        })
        .where(and(eq(tasks.id, open.id), eq(tasks.userId, user.id)))
        .run();
      if (friend.autoschedule) {
        scheduleNextTask(user.id, friend.id, parsed.data.occurredOn);
      }
    }
  } else if (friend.autoschedule) {
    scheduleNextTask(user.id, friend.id, parsed.data.occurredOn);
  }

  revalidate(parsed.data.friendId);
  return {};
}

export async function updateInteraction(
  interactionId: string,
  _prev: InteractionFormState,
  formData: FormData,
): Promise<InteractionFormState> {
  const user = await requireUser();
  const parsed = interactionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };
  const { contactTypeId, occurredOn, note } = parsed.data;
  q.updateInteraction(user.id, interactionId, { contactTypeId, occurredOn, note });
  revalidate(parsed.data.friendId);
  return {};
}

export async function deleteInteraction(
  interactionId: string,
  friendId: string,
): Promise<void> {
  const user = await requireUser();
  q.deleteInteraction(user.id, interactionId);
  revalidate(friendId);
}
