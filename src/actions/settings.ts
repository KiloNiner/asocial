"use server";

import { eq, and, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import {
  notificationChannels,
  userSettings,
  users,
} from "@/db/schema";
import { getSettings, requireUser } from "@/lib/auth/current-user";
import {
  channelRegistry,
} from "@/lib/notifications/dispatch";
import { composeDigest } from "@/lib/notifications/digest";
import { today } from "@/lib/scheduler/clock";
import type { ChannelId } from "@/lib/notifications/channel";

export type SettingsFormState = { error?: string; ok?: boolean };

function revalidate() {
  revalidatePath("/[locale]/settings", "page");
}

const profileSchema = z.object({
  displayName: z.string().trim().min(1).max(100),
  locale: z.enum(["en", "da"]),
  timezone: z.string().min(1).max(60),
});

export async function updateProfile(
  _prev: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const user = await requireUser();
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };
  try {
    // Validate the timezone before persisting it.
    new Intl.DateTimeFormat("en", { timeZone: parsed.data.timezone });
  } catch {
    return { error: "invalidTimezone" };
  }

  db.update(users)
    .set({ displayName: parsed.data.displayName })
    .where(eq(users.id, user.id))
    .run();
  db.update(userSettings)
    .set({ locale: parsed.data.locale, timezone: parsed.data.timezone })
    .where(eq(userSettings.userId, user.id))
    .run();
  revalidate();
  return { ok: true };
}

const schedulingSchema = z.object({
  actionWindowDays: z.coerce.number().int().min(1).max(30),
  jitterPct: z.coerce.number().int().min(0).max(50),
  defaultIntervalDays: z.coerce.number().int().min(1).max(730),
  digestHour: z.coerce.number().int().min(0).max(23),
});

export async function updateSchedulingSettings(
  _prev: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const user = await requireUser();
  const parsed = schedulingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };
  db.update(userSettings)
    .set(parsed.data)
    .where(eq(userSettings.userId, user.id))
    .run();
  revalidate();
  return { ok: true };
}

const channelSchema = z.discriminatedUnion("channel", [
  z.object({
    channel: z.literal("pushover"),
    enabled: z.string().optional(),
    token: z.string().trim(),
    userKey: z.string().trim(),
  }),
  z.object({
    channel: z.literal("email"),
    enabled: z.string().optional(),
    address: z.union([z.literal(""), z.email()]).optional(),
  }),
]);

export async function upsertNotificationChannel(
  _prev: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const user = await requireUser();
  const parsed = channelSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };
  const { channel, enabled, ...config } = parsed.data;

  if (channel === "pushover" && enabled === "on") {
    const check = channelRegistry.pushover.configSchema.safeParse(config);
    if (!check.success) return { error: "pushoverConfigMissing" };
  }

  db.insert(notificationChannels)
    .values({
      userId: user.id,
      channel,
      enabled: enabled === "on",
      config: JSON.stringify(config),
    })
    .onConflictDoUpdate({
      target: [notificationChannels.userId, notificationChannels.channel],
      set: { enabled: enabled === "on", config: JSON.stringify(config) },
    })
    .run();
  revalidate();
  return { ok: true };
}

/** Sends a real digest through one channel right now, ignoring the log. */
export async function sendTestNotification(
  channelId: ChannelId,
): Promise<SettingsFormState> {
  const user = await requireUser();
  const settings = await getSettings(user.id);
  const row = db
    .select()
    .from(notificationChannels)
    .where(
      and(
        eq(notificationChannels.userId, user.id),
        eq(notificationChannels.channel, channelId),
      ),
    )
    .get();
  if (!row) return { error: "channelNotConfigured" };

  const channel = channelRegistry[channelId];
  const localDate = today(settings.timezone);
  const digest = composeDigest(
    [
      {
        id: "test",
        kind: "contact",
        dueDate: localDate,
        friendName: "Test Friend",
        typeEmoji: "☕",
        typeLabel: "Test",
      },
    ],
    localDate,
  )!;

  try {
    await channel.send(user, settings, digest, JSON.parse(row.config));
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "sendFailed" };
  }
}

export type NotificationLogEntry = {
  channel: string;
  digestDate: string;
  status: string;
  error: string | null;
  sentAt: number;
};
