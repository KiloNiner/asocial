"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/current-user";
import { hashPassword } from "@/lib/auth/password";
import {
  createPasswordResetToken,
  findRedeemableReset,
  markResetUsed,
} from "@/lib/auth/password-resets";
import { destroySessionsForUser } from "@/lib/auth/session";

export type CreateResetState = { resetUrl?: string; error?: string };

/** Admin-only: mint a one-time reset link for a user to be relayed out of
 *  band (no email delivery required). */
export async function createPasswordReset(
  userId: string,
): Promise<CreateResetState> {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "admin") return { error: "unauthorized" };
  const target = db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .get();
  if (!target) return { error: "invalid" };

  const { token } = createPasswordResetToken(admin.id, userId);
  console.log(
    "[auth] password reset link generated:",
    JSON.stringify({ adminId: admin.id, targetUserId: userId }),
  );
  const base = process.env.APP_URL ?? "http://localhost:3000";
  return { resetUrl: `${base}/reset-password?token=${token}` };
}

export type CompleteResetState = { error?: string; ok?: boolean };

const completeSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(10).max(200),
});

/** Public: redeem a reset token and set a new password. Signs the account
 *  out everywhere so an old, possibly-compromised session can't linger. */
export async function completePasswordReset(
  _prev: CompleteResetState,
  formData: FormData,
): Promise<CompleteResetState> {
  const parsed = completeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };

  const reset = findRedeemableReset(parsed.data.token);
  if (!reset) return { error: "resetInvalid" };

  const passwordHash = await hashPassword(parsed.data.password);
  db.update(users)
    .set({ passwordHash })
    .where(eq(users.id, reset.userId))
    .run();
  markResetUsed(reset.id);
  destroySessionsForUser(reset.userId);
  console.log(
    "[auth] password reset completed:",
    JSON.stringify({ userId: reset.userId }),
  );
  return { ok: true };
}
