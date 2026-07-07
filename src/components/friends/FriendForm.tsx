"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import {
  createFriend,
  updateFriend,
  type FriendFormState,
} from "@/actions/friends";
import type { Circle, Friend } from "@/db/schema";
import {
  buttonClass,
  errorClass,
  inputClass,
  labelClass,
} from "@/components/ui/classes";

export function FriendForm({
  friend,
  allCircles,
  memberCircleIds,
}: Readonly<{
  friend?: Friend;
  allCircles: Circle[];
  memberCircleIds?: string[];
}>) {
  const t = useTranslations();
  const action = friend ? updateFriend.bind(null, friend.id) : createFriend;
  const [state, formAction, pending] = useActionState<FriendFormState, FormData>(
    action,
    {},
  );
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-4">
      {state.error ? (
        <p className={errorClass}>{t(`common.errors.${state.error}`)}</p>
      ) : null}

      <label className={labelClass}>
        {t("friends.name")}
        <input
          name="name"
          required
          maxLength={100}
          defaultValue={friend?.name}
          className={inputClass}
        />
      </label>

      <fieldset className="flex flex-col gap-1 text-sm">
        <legend className="mb-1">{t("friends.circlesLabel")}</legend>
        {allCircles.length === 0 ? (
          <p className="text-xs text-stone-500">{t("friends.noCircles")}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {allCircles.map((circle) => (
              <label
                key={circle.id}
                className="flex cursor-pointer items-center gap-1.5 rounded-full border border-stone-300 px-3 py-1.5 text-sm has-checked:border-stone-800 has-checked:bg-stone-100"
              >
                <input
                  type="checkbox"
                  name="circleIds"
                  value={circle.id}
                  defaultChecked={memberCircleIds?.includes(circle.id)}
                  className="sr-only"
                />
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: circle.color }}
                />
                {circle.name}
                <span className="text-xs text-stone-400">
                  {circle.intervalDays}d
                </span>
              </label>
            ))}
          </div>
        )}
      </fieldset>

      <label className={labelClass}>
        {t("friends.intervalOverride")} ({t("common.days")})
        <input
          name="intervalOverrideDays"
          type="number"
          min={1}
          max={730}
          defaultValue={friend?.intervalOverrideDays ?? ""}
          className={inputClass}
        />
        <span className="text-xs text-stone-500">
          {t("friends.intervalOverrideHint")}
        </span>
      </label>

      <fieldset className="flex flex-col gap-1 text-sm">
        <legend className="mb-1">{t("friends.birthday")}</legend>
        <div className="flex gap-2">
          <label className="flex flex-col gap-0.5 text-xs text-stone-600">
            {t("friends.birthdayDay")}
            <input
              name="birthDay"
              type="number"
              min={1}
              max={31}
              defaultValue={friend?.birthDay ?? ""}
              className={`${inputClass} w-20`}
            />
          </label>
          <label className="flex flex-col gap-0.5 text-xs text-stone-600">
            {t("friends.birthdayMonth")}
            <select
              name="birthMonth"
              defaultValue={friend?.birthMonth ?? ""}
              className={`${inputClass} w-36`}
            >
              <option value=""></option>
              {months.map((m) => (
                <option key={m} value={m}>
                  {new Intl.DateTimeFormat(undefined, { month: "long" }).format(
                    new Date(2000, m - 1, 1),
                  )}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-0.5 text-xs text-stone-600">
            {t("friends.birthdayYear", { optional: t("common.optional") })}
            <input
              name="birthYear"
              type="number"
              min={1900}
              max={2100}
              defaultValue={friend?.birthYear ?? ""}
              className={`${inputClass} w-24`}
            />
          </label>
        </div>
      </fieldset>

      <label className={labelClass}>
        {t("friends.notes")}
        <textarea
          name="notes"
          rows={3}
          maxLength={5000}
          defaultValue={friend?.notes ?? ""}
          placeholder={t("friends.notesHint")}
          className={inputClass}
        />
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="autoschedule"
          defaultChecked={friend?.autoschedule ?? true}
          className="h-4 w-4 accent-teal-700"
        />
        {t("friends.autoschedule")}
      </label>

      <button type="submit" disabled={pending} className={buttonClass}>
        {t("common.save")}
      </button>
    </form>
  );
}
