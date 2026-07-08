"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/current-user";
import * as q from "@/lib/db/queries";

export type CircleFormState = { error?: string };

const circleSchema = z.object({
  name: z.string().trim().min(1).max(60),
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
  intervalDays: z.coerce.number().int().min(1).max(730),
});

function revalidate() {
  revalidatePath("/[locale]/circles", "page");
  revalidatePath("/[locale]/friends", "page");
}

export async function createCircle(
  _prev: CircleFormState,
  formData: FormData,
): Promise<CircleFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "unauthorized" };
  const parsed = circleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };
  try {
    q.createCircle(user.id, parsed.data);
  } catch {
    return { error: "duplicateName" };
  }
  revalidate();
  return {};
}

export async function updateCircle(
  circleId: string,
  _prev: CircleFormState,
  formData: FormData,
): Promise<CircleFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "unauthorized" };
  const parsed = circleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };
  try {
    q.updateCircle(user.id, circleId, parsed.data);
  } catch {
    return { error: "duplicateName" };
  }
  revalidate();
  return {};
}

export async function deleteCircle(circleId: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  q.deleteCircle(user.id, circleId);
  revalidate();
}

const prefSchema = z.object({
  contactTypeId: z.string().min(1),
  // "" clears the pref back to inherited
  weight: z.union([
    z.literal("").transform(() => null),
    z.coerce.number().int().min(0).max(100),
  ]),
});

export async function setCirclePref(
  circleId: string,
  formData: FormData,
): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const parsed = prefSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  q.setCirclePref(
    user.id,
    circleId,
    parsed.data.contactTypeId,
    parsed.data.weight,
  );
  revalidatePath("/[locale]/circles", "page");
}
