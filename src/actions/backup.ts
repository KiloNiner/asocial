"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  BACKUP_VERSION,
  importUserData,
  type BackupData,
} from "@/lib/db/queries";
import { sweepUserContactTasks } from "@/lib/scheduler/daily-job";

export type BackupFormState = {
  error?: string;
  imported?: { circles: number; friends: number; interactions: number };
};

// Rows are inserted as-is (ownership is forced server-side), so the schema
// only needs to assert the shape is a well-formed backup, not police columns.
const row = z.record(z.string(), z.unknown());
const backupSchema = z.object({
  version: z.literal(BACKUP_VERSION),
  exportedAt: z.string().optional(),
  circles: z.array(row),
  friends: z.array(row),
  friendCircles: z.array(row),
  contactTypes: z.array(row),
  userContactPrefs: z.array(row),
  circleContactPrefs: z.array(row),
  friendContactPrefs: z.array(row),
  interactions: z.array(row),
});

export async function importBackup(
  _prev: BackupFormState,
  formData: FormData,
): Promise<BackupFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "unauthorized" };
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "invalidFile" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    return { error: "invalidFile" };
  }

  const result = backupSchema.safeParse(parsed);
  if (!result.success) {
    return { error: "invalidFile" };
  }

  const counts = importUserData(user.id, result.data as unknown as BackupData);
  // Regenerate the suggestions that were intentionally left out of the backup.
  sweepUserContactTasks(user.id);

  revalidatePath("/", "layout");
  return {
    imported: {
      circles: counts.circles,
      friends: counts.friends,
      interactions: counts.interactions,
    },
  };
}
