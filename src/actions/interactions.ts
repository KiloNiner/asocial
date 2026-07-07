"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/current-user";
import * as q from "@/lib/db/queries";

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
  if (!q.getFriend(user.id, parsed.data.friendId)) return { error: "invalid" };

  q.createInteraction(user.id, parsed.data);
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
  const { friendId: _ignored, ...data } = parsed.data;
  q.updateInteraction(user.id, interactionId, data);
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
