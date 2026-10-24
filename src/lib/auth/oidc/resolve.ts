import { count, eq, and } from "drizzle-orm";
import { db } from "@/db";
import {
  notificationChannels,
  oidcIdentities,
  users,
  userSettings,
} from "@/db/schema";
import { UNUSABLE_PASSWORD_HASH } from "@/lib/auth/password";
import { smtpConfigured } from "@/lib/notifications/channel";
import type { OidcConfig } from "./config";
import type { OidcIdentity } from "./client";
import { decideRole, decideSignIn, type DenyReason } from "./decide";

export type SignInOutcome =
  | {
      userId: string;
      how: "existing" | "linked" | "created";
      roleChange?: "admin" | "user";
    }
  | { error: DenyReason };

/**
 * Maps a verified provider identity onto a local user, linking or creating as
 * policy allows. One synchronous transaction: reading "does this user exist /
 * is this the first user" and acting on it must not interleave with another
 * sign-in, or two first logins could both become admin.
 */
export function resolveSignIn(
  cfg: OidcConfig,
  identity: OidcIdentity,
  locale: "en" | "da" | "sv" | "tlh",
): SignInOutcome {
  const emailDefault = smtpConfigured();

  return db.transaction((tx) => {
    const linked = tx
      .select({ userId: oidcIdentities.userId })
      .from(oidcIdentities)
      .where(
        and(
          eq(oidcIdentities.issuer, identity.issuer),
          eq(oidcIdentities.subject, identity.subject),
        ),
      )
      .get();
    const emailUser = identity.email
      ? tx.select({ id: users.id }).from(users).where(eq(users.email, identity.email)).get()
      : undefined;
    const userCount = tx.select({ n: count() }).from(users).get()?.n ?? 0;

    const decision = decideSignIn({
      linkedUserId: linked?.userId ?? null,
      emailUserId: emailUser?.id ?? null,
      userCount,
      claims: { email: identity.email, emailVerified: identity.emailVerified },
      autoRegister: cfg.autoRegister,
      trustUnverifiedEmail: cfg.trustUnverifiedEmail,
    });

    const inAdminGroup =
      cfg.adminGroup && identity.groups
        ? identity.groups.includes(cfg.adminGroup)
        : null;

    /** Applies the group → role mapping to an account that already exists. */
    const syncRole = (userId: string) => {
      const user = tx
        .select({ role: users.role })
        .from(users)
        .where(eq(users.id, userId))
        .get();
      if (!user) return undefined;
      const adminCount =
        tx.select({ n: count() }).from(users).where(eq(users.role, "admin")).get()?.n ?? 0;
      const role = decideRole({ currentRole: user.role, inAdminGroup, adminCount });
      if (!role) return undefined;
      tx.update(users).set({ role }).where(eq(users.id, userId)).run();
      return role;
    };

    switch (decision.kind) {
      case "deny":
        return { error: decision.reason };
      case "existing":
        return {
          userId: decision.userId,
          how: "existing" as const,
          roleChange: syncRole(decision.userId),
        };
      case "link":
        tx.insert(oidcIdentities)
          .values({
            userId: decision.userId,
            issuer: identity.issuer,
            subject: identity.subject,
          })
          .run();
        return {
          userId: decision.userId,
          how: "linked" as const,
          roleChange: syncRole(decision.userId),
        };
      case "create": {
        // decideSignIn only reaches here with an email.
        const email = identity.email as string;
        const user = tx
          .insert(users)
          .values({
            email,
            passwordHash: UNUSABLE_PASSWORD_HASH,
            displayName: (identity.name ?? email.split("@")[0]).slice(0, 100),
            role: decision.admin || inAdminGroup ? "admin" : "user",
          })
          .returning({ id: users.id })
          .get();
        tx.insert(userSettings).values({ userId: user.id, locale }).run();
        tx.insert(oidcIdentities)
          .values({
            userId: user.id,
            issuer: identity.issuer,
            subject: identity.subject,
          })
          .run();
        // Same default as registration: an empty email config means "the
        // account address", so a new user is reachable without opening Settings.
        if (emailDefault) {
          tx.insert(notificationChannels)
            .values({ userId: user.id, channel: "email", enabled: true, config: "{}" })
            .run();
        }
        return { userId: user.id, how: "created" as const };
      }
    }
  });
}
