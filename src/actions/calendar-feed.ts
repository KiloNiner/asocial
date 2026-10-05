"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  deleteCalendarFeed,
  rotateCalendarFeedToken,
} from "@/lib/auth/calendar-feed";

function revalidate() {
  revalidatePath("/[locale]/calendar", "page");
}

/** Turns the feed on, or replaces its URL (old subscriptions stop updating). */
export async function rotateCalendarFeed(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  rotateCalendarFeedToken(user.id);
  revalidate();
}

export async function disableCalendarFeed(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  deleteCalendarFeed(user.id);
  revalidate();
}
