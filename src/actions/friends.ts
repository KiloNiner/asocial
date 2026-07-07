"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/current-user";
import * as q from "@/lib/db/queries";
import { redirect } from "@/i18n/navigation";

export type FriendFormState = { error?: string };

const optionalInt = (min: number, max: number) =>
  z.union([
    z.literal("").transform(() => null),
    z.undefined().transform(() => null),
    z.coerce.number().int().min(min).max(max),
  ]);

const friendSchema = z.object({
  name: z.string().trim().min(1).max(100),
  notes: z
    .string()
    .max(5000)
    .optional()
    .transform((v) => (v?.trim() ? v.trim() : null)),
  intervalOverrideDays: optionalInt(1, 730),
  autoschedule: z
    .string()
    .optional()
    .transform((v) => v === "on"),
  birthMonth: optionalInt(1, 12),
  birthDay: optionalInt(1, 31),
  birthYear: optionalInt(1900, 2100),
});

function parseFriendForm(formData: FormData) {
  const parsed = friendSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return null;
  const data = parsed.data;
  // Birthday must be complete (day+month) or absent; year alone is meaningless.
  const hasBirthday = data.birthMonth !== null && data.birthDay !== null;
  if (!hasBirthday && (data.birthMonth !== null || data.birthDay !== null)) {
    return null;
  }
  return {
    ...data,
    birthYear: hasBirthday ? data.birthYear : null,
    birthMonth: hasBirthday ? data.birthMonth : null,
    birthDay: hasBirthday ? data.birthDay : null,
    circleIds: formData.getAll("circleIds").map(String),
  };
}

function revalidate(friendId?: string) {
  revalidatePath("/[locale]/friends", "page");
  if (friendId) revalidatePath(`/[locale]/friends/${friendId}`, "page");
}

export async function createFriend(
  _prev: FriendFormState,
  formData: FormData,
): Promise<FriendFormState> {
  const user = await requireUser();
  const input = parseFriendForm(formData);
  if (!input) return { error: "invalid" };
  const friend = q.createFriend(user.id, input);
  revalidate();
  redirect({ href: `/friends/${friend.id}`, locale: await getLocale() });
  return {};
}

export async function updateFriend(
  friendId: string,
  _prev: FriendFormState,
  formData: FormData,
): Promise<FriendFormState> {
  const user = await requireUser();
  const input = parseFriendForm(formData);
  if (!input) return { error: "invalid" };
  q.updateFriend(user.id, friendId, input);
  revalidate(friendId);
  redirect({ href: `/friends/${friendId}`, locale: await getLocale() });
  return {};
}

export async function setFriendArchived(
  friendId: string,
  archived: boolean,
): Promise<void> {
  const user = await requireUser();
  q.setFriendArchived(user.id, friendId, archived);
  revalidate(friendId);
}

const prefSchema = z.object({
  contactTypeId: z.string().min(1),
  weight: z.union([
    z.literal("").transform(() => null),
    z.coerce.number().int().min(0).max(100),
  ]),
});

export async function setFriendPref(
  friendId: string,
  formData: FormData,
): Promise<void> {
  const user = await requireUser();
  const parsed = prefSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  q.setFriendPref(
    user.id,
    friendId,
    parsed.data.contactTypeId,
    parsed.data.weight,
  );
  revalidate(friendId);
}
