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

export const pushoverConfigSchema = z.object({
  token: z.string().min(1),
  userKey: z.string().min(1),
});

export const emailConfigSchema = z.object({
  // Defaults to the account email when empty.
  address: z.union([z.literal(""), z.email()]).optional(),
});
