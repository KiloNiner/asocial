"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, getSettings } from "@/lib/auth/current-user";
import { backupSchema } from "@/lib/db/backup-schema";
import { importUserData } from "@/lib/db/queries";
import { sweepUserContactTasks } from "@/lib/scheduler/daily-job";

export type BackupFormState = {
  error?: string;
  imported?: { circles: number; friends: number; interactions: number };
};

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

  // Each row is validated against the same per-table bounds the create/update
  // actions enforce (see lib/db/backup-schema.ts) — restore is not a back
  // door around those constraints. importUserData() additionally forces
  // ownership on every row and drops any friendCircles/circleContactPrefs/
  // friendContactPrefs/interactions row that references a friendId/circleId
  // not owned by this user.
  const result = backupSchema.safeParse(parsed);
  if (!result.success) {
    return { error: "invalidFile" };
  }

  // The schema catches every file-level problem it can see, but the insert can
  // still fail on state only the DB knows — so a restore is never allowed to
  // escape as an unhandled server error. It runs in a single transaction, so a
  // failure here leaves the account's existing data intact.
  let counts;
  try {
    counts = importUserData(user.id, result.data);
  } catch (err) {
    console.error(
      "[backup] restore failed:",
      JSON.stringify({
        userId: user.id,
        message: err instanceof Error ? err.message : String(err),
      }),
    );
    return { error: "invalidFile" };
  }
  // Regenerate the suggestions that were intentionally left out of the backup.
  const settings = await getSettings(user.id);
  sweepUserContactTasks(user.id, settings.timezone);

  revalidatePath("/", "layout");
  return {
    imported: {
      circles: counts.circles,
      friends: counts.friends,
      interactions: counts.interactions,
    },
  };
}
