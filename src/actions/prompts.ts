"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  DISMISSED_COOKIE,
  DISMISSED_MAX_AGE,
  dismissedPrompts,
  isPromptKey,
} from "@/lib/prompts";

/** Put a dashboard prompt away for this browser. */
export async function dismissPrompt(key: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  if (!isPromptKey(key)) return;

  const dismissed = await dismissedPrompts();
  dismissed.add(key);
  (await cookies()).set(DISMISSED_COOKIE, [...dismissed].join(","), {
    path: "/",
    maxAge: DISMISSED_MAX_AGE,
    sameSite: "lax",
  });
  revalidatePath("/[locale]", "page");
}
