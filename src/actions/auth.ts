"use server";

import { count, eq } from "drizzle-orm";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { db } from "@/db";
import { users, userSettings } from "@/db/schema";
import {
  findRedeemableInvite,
  markInviteUsed,
} from "@/lib/auth/invites";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession } from "@/lib/auth/session";
import { redirect } from "@/i18n/navigation";

export type AuthFormState = { error?: string };

const registerSchema = z.object({
  email: z.email().transform((v) => v.toLowerCase().trim()),
  displayName: z.string().trim().min(1).max(100),
  password: z.string().min(10).max(200),
  invite: z.string().optional(),
});

const loginSchema = z.object({
  email: z.email().transform((v) => v.toLowerCase().trim()),
  password: z.string().min(1),
});

function userCount(): number {
  return db.select({ n: count() }).from(users).get()?.n ?? 0;
}

export async function register(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const locale = await getLocale();
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: "invalid" };
  }
  const { email, displayName, password, invite } = parsed.data;

  const bootstrap = userCount() === 0;
  let inviteId: string | null = null;
  if (!bootstrap) {
    inviteId = invite ? findRedeemableInvite(invite) : null;
    if (!inviteId) return { error: "inviteInvalid" };
  }

  if (db.select().from(users).where(eq(users.email, email)).get()) {
    return { error: "emailTaken" };
  }

  const passwordHash = await hashPassword(password);
  const userId = db.transaction((tx) => {
    const user = tx
      .insert(users)
      .values({
        email,
        passwordHash,
        displayName,
        role: bootstrap ? "admin" : "user",
      })
      .returning({ id: users.id })
      .get();
    const initialLocale = (["en", "da", "sv", "tlh"] as const).includes(
      locale as "en" | "da" | "sv" | "tlh",
    )
      ? (locale as "en" | "da" | "sv" | "tlh")
      : "en";
    tx.insert(userSettings)
      .values({ userId: user.id, locale: initialLocale })
      .run();
    if (inviteId) markInviteUsed(inviteId, user.id);
    return user.id;
  });

  await createSession(userId);
  redirect({ href: "/", locale });
  return {};
}

export async function login(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const locale = await getLocale();
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalidCredentials" };

  const user = db
    .select()
    .from(users)
    .where(eq(users.email, parsed.data.email))
    .get();
  // Verify against a dummy hash on unknown emails to keep timing uniform.
  const ok = await verifyPassword(
    user?.passwordHash ??
      "$argon2id$v=19$m=19456,t=2,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    parsed.data.password,
  );
  if (!user || !ok) return { error: "invalidCredentials" };

  await createSession(user.id);
  redirect({ href: "/", locale });
  return {};
}

export async function logout(): Promise<void> {
  const locale = await getLocale();
  await destroySession();
  redirect({ href: "/login", locale });
}

/** Whether the register page should run in first-user bootstrap mode. */
export async function isBootstrap(): Promise<boolean> {
  return userCount() === 0;
}
