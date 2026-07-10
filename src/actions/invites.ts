"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { invites } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/current-user";
import { createInviteToken } from "@/lib/auth/invites";

export type InviteFormState = { inviteUrl?: string; error?: string };

const createSchema = z.object({
  email: z
    .union([z.literal(""), z.email()])
    .optional()
    .transform((v) => (v ? v.toLowerCase().trim() : undefined)),
});

export async function createInvite(
  _prev: InviteFormState,
  formData: FormData,
): Promise<InviteFormState> {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "admin") return { error: "unauthorized" };
  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };

  const { token } = createInviteToken(admin.id, parsed.data.email);
  const base = process.env.APP_URL ?? "http://localhost:3000";
  revalidatePath("/[locale]/admin", "page");
  return { inviteUrl: `${base}/register?invite=${token}` };
}

export async function revokeInvite(inviteId: string): Promise<void> {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "admin") return;
  db.delete(invites).where(eq(invites.id, inviteId)).run();
  revalidatePath("/[locale]/admin", "page");
}
