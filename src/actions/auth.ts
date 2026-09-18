"use server";

import { count, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { db } from "@/db";
import { notificationChannels, users, userSettings } from "@/db/schema";
import {
  findRedeemableInvite,
  markInviteUsed,
} from "@/lib/auth/invites";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  clearAttempts,
  isLimited,
  LOGIN_LIMITS,
  recordAttempt,
} from "@/lib/auth/rate-limit";
import { createSession, destroySession } from "@/lib/auth/session";
import { getSettings } from "@/lib/auth/current-user";
import { smtpConfigured } from "@/lib/notifications/channel";
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

/** First character plus domain — enough for an operator who knows their own
 *  users to tell which account is being hit, without writing the address to
 *  disk in full. Mirrors the intent of maskIp(). */
function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at <= 0) return "***";
  return `${email[0]}***${email.slice(at)}`;
}

/**
 * The caller's IP, unmasked. Rate limiting needs the exact address (a /24 is
 * shared by everyone behind one NAT), so masking happens at the log site
 * rather than here — this value must never be passed to console directly.
 */
async function clientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
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

  // Hash before opening the transaction: argon2 runs on the libuv threadpool,
  // so awaiting it is a real yield point. Reading the invite / user count on
  // one side of that await and acting on it afterwards let two concurrent
  // registrations both redeem the same single-use invite, or both pass the
  // "no users yet" test and both be created as admin. Everything that reads
  // and then writes now happens inside one synchronous transaction, which
  // better-sqlite3 runs to completion with nothing interleaved.
  const passwordHash = await hashPassword(password);

  const initialLocale = (["en", "da", "sv", "tlh"] as const).includes(
    locale as "en" | "da" | "sv" | "tlh",
  )
    ? (locale as "en" | "da" | "sv" | "tlh")
    : "en";

  const emailDefault = smtpConfigured();

  const outcome = db.transaction((tx) => {
    const bootstrap = tx.select({ n: count() }).from(users).get()?.n === 0;

    let inviteId: string | null = null;
    if (!bootstrap) {
      inviteId = invite ? findRedeemableInvite(invite, tx) : null;
      if (!inviteId) return { error: "inviteInvalid" as const };
    }

    if (tx.select().from(users).where(eq(users.email, email)).get()) {
      return { error: "emailTaken" as const };
    }

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
    tx.insert(userSettings)
      .values({ userId: user.id, locale: initialLocale })
      .run();
    // Notifications used to start at zero channels, so an account that never
    // opened Settings was never contacted again — the app went silent the
    // moment registration finished, which is precisely when someone has the
    // least reason to come back on their own. An empty email config means
    // "the account address", so this needs nothing from the new user. Only
    // where SMTP can actually deliver: see smtpConfigured().
    if (emailDefault) {
      tx.insert(notificationChannels)
        .values({
          userId: user.id,
          channel: "email",
          enabled: true,
          config: "{}",
        })
        .run();
    }
    if (inviteId) markInviteUsed(inviteId, user.id, tx);
    return { userId: user.id, bootstrap };
  });

  if ("error" in outcome) return { error: outcome.error };

  // Registration logs the user straight in (same as login), so it needs
  // its own success line rather than relying on a separate login attempt.
  console.log(
    "[auth] registration succeeded:",
    JSON.stringify({
      userId: outcome.userId,
      role: outcome.bootstrap ? "admin" : "user",
      emailDigest: emailDefault,
      ip: maskIp(ip),
    }),
  );
  await createSession(outcome.userId);
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
      JSON.stringify({ reason: "invalidInput", ip: maskIp(ip) }),
    );
    return { error: "invalidCredentials" };
  }

  const ipKey = `login:ip:${ip}`;
  const accountKey = `login:account:${parsed.data.email}`;

  // Checked before verifying, so a spent window costs no argon2 work.
  if (
    isLimited(ipKey, LOGIN_LIMITS.perIp) ||
    isLimited(accountKey, LOGIN_LIMITS.perAccount)
  ) {
    console.warn(
      "[auth] login blocked:",
      JSON.stringify({
        reason: "rateLimited",
        email: maskEmail(parsed.data.email),
        ip: maskIp(ip),
      }),
    );
    return { error: "tooManyAttempts" };
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
    const ipAllowed = recordAttempt(ipKey, LOGIN_LIMITS.perIp);
    const accountAllowed = recordAttempt(accountKey, LOGIN_LIMITS.perAccount);
    console.warn(
      "[auth] login failed:",
      JSON.stringify({
        reason: "invalidCredentials",
        // Masked like the IP is: enough to see which account is being hit
        // without writing the full address to the container log.
        email: maskEmail(parsed.data.email),
        ip: maskIp(ip),
      }),
    );
    return {
      error: ipAllowed && accountAllowed ? "invalidCredentials" : "tooManyAttempts",
    };
  }

  // A good password forgives the account's failures, so a user who mistypes a
  // few times and then succeeds is never locked out by their own attempts.
  clearAttempts(ipKey);
  clearAttempts(accountKey);

  console.log(
    "[auth] login succeeded:",
    JSON.stringify({ userId: user.id, ip: maskIp(ip) }),
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
