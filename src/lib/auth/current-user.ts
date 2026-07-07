import { cache } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { userSettings, type User, type UserSettings } from "@/db/schema";
import { validateSession } from "./session";

export const getCurrentUser = cache(async (): Promise<User | null> => {
  return validateSession();
});

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
