import { cache } from "react";
import { eq } from "drizzle-orm";
import { getLocale } from "next-intl/server";
import { db } from "@/db";
import { userSettings, type User, type UserSettings } from "@/db/schema";
import { redirect } from "@/i18n/navigation";
import { validateSession } from "./session";

export const getCurrentUser = cache(async (): Promise<User | null> => {
  return validateSession();
});

/**
 * For server actions: an uncaught throw here is a genuine bug in the
 * calling action (it should have checked getCurrentUser() itself first),
 * since Next logs any throw that crosses the action boundary as an error.
 */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (user.role !== "admin") throw new Error("Forbidden");
  return user;
}

/**
 * For page/layout Server Components: redirect to login instead of throwing
 * when unauthenticated. redirect() throws Next's own control-flow signal,
 * which — unlike requireUser()'s plain Error — Next recognizes and does not
 * log as a server error.
 */
export async function requireUserOrRedirect(): Promise<User> {
  const user = await getCurrentUser();
  if (user) return user;
  return redirect({ href: "/login", locale: await getLocale() });
}

export const getSettings = cache(
  async (userId: string): Promise<UserSettings> => {
    const settings = db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .get();
    if (!settings) throw new Error(`Missing settings for user ${userId}`);
    return settings;
  },
);
