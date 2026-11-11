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
  buttonGhostClass,
  cardClass,
  checkboxClass,
  errorClass,
  hintClass,
  inputClass,
  labelClass,
} from "@/components/ui/classes";
import { Link } from "@/i18n/navigation";

export function FriendForm({
  friend,
  allCircles,
  memberCircleIds,
  activityPrefs,
}: Readonly<{
  friend?: Friend;
  allCircles: Circle[];
  memberCircleIds?: string[];
  activityPrefs?: React.ReactNode;
}>) {
  const t = useTranslations();
  const action = friend ? updateFriend.bind(null, friend.id) : createFriend;
  const [state, formAction, pending] = useActionState<FriendFormState, FormData>(
    action,
    {},
  );
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <form
      action={formAction}
      className={`${cardClass} flex max-w-2xl flex-col gap-5 sm:p-6`}
    >
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

      <fieldset className="flex flex-col gap-1.5 text-sm">
        <legend className="mb-1.5 font-medium">{t("friends.circlesLabel")}</legend>
        {allCircles.length === 0 ? (
          <p className={hintClass}>{t("friends.noCircles")}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {allCircles.map((circle) => (
              <label
                key={circle.id}
                className="flex items-center gap-2 rounded-full border border-line bg-panel px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-faint has-checked:border-accent/50 has-checked:bg-accent-soft has-checked:text-accent-ink has-focus-visible:ring-2 has-focus-visible:ring-accent"
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
                <span className="text-xs font-normal opacity-70">
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
          className={`${inputClass} w-32`}
        />
        <span className={hintClass}>{t("friends.intervalOverrideHint")}</span>
      </label>

      <fieldset className="flex flex-col gap-1.5 text-sm">
        <legend className="mb-1.5 font-medium">{t("friends.birthday")}</legend>
        <div className="flex flex-wrap gap-2">
          <label className="flex flex-col gap-1 text-xs text-muted">
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
          <label className="flex flex-col gap-1 text-xs text-muted">
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
          <label className="flex flex-col gap-1 text-xs text-muted">
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

      {activityPrefs}

      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          name="autoschedule"
          defaultChecked={friend?.autoschedule ?? true}
          className={checkboxClass}
        />
        {t("friends.autoschedule")}
      </label>

      <div className="flex items-center gap-2 border-t border-line pt-5">
        <button type="submit" disabled={pending} className={buttonClass}>
          {t("common.save")}
        </button>
        <Link
          href={friend ? `/friends/${friend.id}` : "/friends"}
          className={buttonGhostClass}
        >
          {t("common.cancel")}
        </Link>
      </div>
    </form>
  );
}
