import { z, type ZodType } from "zod";
import type { User, UserSettings } from "@/db/schema";
import type { Digest } from "./digest";

export type ChannelId = "pushover" | "email";

export interface NotificationChannel {
  id: ChannelId;
  configSchema: ZodType;
  /** Throws on failure; dispatch logs the outcome. */
  send(
    user: User,
    settings: UserSettings,
    digest: Digest,
    config: unknown,
  ): Promise<void>;
}

/**
 * Config keys that must never travel back to the browser.
 *
 * `getNotificationChannels()` strips these before the settings page renders,
 * and `upsertNotificationChannel()` treats a blank one as "leave it alone" —
 * so a saved secret can be replaced but never read back out.
 */
export const SECRET_CONFIG_KEYS: Record<ChannelId, readonly string[]> = {
  pushover: ["token", "userKey"],
  email: [],
};

export const pushoverConfigSchema = z.object({
  token: z.string().min(1),
  userKey: z.string().min(1),
});

export const emailConfigSchema = z.object({
  // Defaults to the account email when empty.
  address: z.union([z.literal(""), z.email()]).optional(),
});

/**
 * Whether outbound email is possible at all on this deployment.
 *
 * SMTP is optional in asocial, so the email digest can only be *defaulted* on
 * where it would actually deliver — otherwise a new account would start life
 * with a channel that fails every day. Lives here rather than in
 * `channels/email.ts` so callers that only need the answer (registration, the
 * register form) don't pull nodemailer in with it.
 */
export function smtpConfigured(): boolean {
  return !!process.env.SMTP_HOST;
}
