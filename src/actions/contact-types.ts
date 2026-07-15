"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/current-user";
import * as q from "@/lib/db/queries";
import { isSingleEmoji } from "@/lib/validation/emoji";

export type ContactTypeFormState = { error?: string };

const createSchema = z.object({
  name: z.string().trim().min(1).max(60),
  // Blank is allowed (no icon for this activity type); non-blank must be
  // exactly one emoji, including skin-tone/ZWJ/flag/keycap sequences.
  emoji: z
    .string()
    .trim()
    .max(32)
    .refine((v) => v === "" || isSingleEmoji(v), { message: "invalid" })
    .transform((v) => (v === "" ? null : v)),
  defaultWeight: z.coerce.number().int().min(0).max(100),
});

function revalidate() {
  revalidatePath("/[locale]/settings", "page");
}

export async function createCustomContactType(
  _prev: ContactTypeFormState,
  formData: FormData,
): Promise<ContactTypeFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "unauthorized" };
  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };
  q.createCustomContactType(user.id, parsed.data);
  revalidate();
  return {};
}

export async function setContactTypeArchived(
  typeId: string,
  archived: boolean,
): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  q.setContactTypeArchived(user.id, typeId, archived);
  revalidate();
}

const prefSchema = z.object({
  contactTypeId: z.string().min(1),
  weight: z.union([
    z.literal("").transform(() => null),
    z.coerce.number().int().min(0).max(100),
  ]),
});

/** User-level global weight/disable for a type ("" resets to default). */
export async function setUserContactPref(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const parsed = prefSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  q.setUserPref(user.id, parsed.data.contactTypeId, parsed.data.weight);
  revalidate();
}
