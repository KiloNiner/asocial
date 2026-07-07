"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/current-user";
import * as q from "@/lib/db/queries";

export type ContactTypeFormState = { error?: string };

const createSchema = z.object({
  name: z.string().trim().min(1).max(60),
  emoji: z.string().trim().min(1).max(8),
  defaultWeight: z.coerce.number().int().min(0).max(100),
});

function revalidate() {
  revalidatePath("/[locale]/settings", "page");
}

export async function createCustomContactType(
  _prev: ContactTypeFormState,
  formData: FormData,
): Promise<ContactTypeFormState> {
  const user = await requireUser();
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
  const user = await requireUser();
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
  const user = await requireUser();
  const parsed = prefSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  q.setUserPref(user.id, parsed.data.contactTypeId, parsed.data.weight);
  revalidate();
}
