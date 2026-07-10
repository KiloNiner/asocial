"use server";

import { count, eq } from "drizzle-orm";
import { headers } from "next/headers";
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
import { getSettings } from "@/lib/auth/current-user";
import { redirect } from "@/i18n/navigation";

export type AuthFormState = { error?: string };

/** Zero the last IPv4 octet / collapse IPv6 to its /64 — enough to spot
 *  abuse patterns from a subnet without logging a re-identifiable address. */
function maskIp(ip: string): string {
  if (ip.includes(":")) {
    return `${ip.split(":").slice(0, 4).join(":")}::`;
  }
  const parts = ip.split(".");
  return parts.length === 4 ? `${parts.slice(0, 3).join(".")}.0` : ip;
}

async function clientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  return ip === "unknown" ? ip : maskIp(ip);
}

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
  const ip = await clientIp();
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

  // Registration logs the user straight in (same as login), so it needs
  // its own success line rather than relying on a separate login attempt.
  console.log(
    "[auth] registration succeeded:",
    JSON.stringify({ userId, role: bootstrap ? "admin" : "user", ip }),
  );
  await createSession(userId);
  redirect({ href: "/", locale });
  return {};
}

export async function login(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const ip = await clientIp();
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    console.warn(
      "[auth] login failed:",
      JSON.stringify({ reason: "invalidInput", ip }),
    );
    return { error: "invalidCredentials" };
  }

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
  if (!user || !ok) {
    console.warn(
      "[auth] login failed:",
      JSON.stringify({ reason: "invalidCredentials", email: parsed.data.email, ip }),
    );
    return { error: "invalidCredentials" };
  }

  console.log(
    "[auth] login succeeded:",
    JSON.stringify({ userId: user.id, ip }),
  );
  await createSession(user.id);
  // Redirect to the account's own locale, not whatever locale this browser's
  // login page happened to render under — this app routes locale by URL
  // segment, so a stale NEXT_LOCALE cookie on another device won't catch up
  // to a Settings-page locale change until the user explicitly lands here.
  const settings = await getSettings(user.id);
  redirect({ href: "/", locale: settings.locale });
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
