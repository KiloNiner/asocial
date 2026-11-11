"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import {
  sendTestNotification,
  updateProfile,
  updateSchedulingSettings,
  upsertNotificationChannel,
  type SettingsFormState,
} from "@/actions/settings";
import type { User, UserSettings } from "@/db/schema";
import type { ChannelId } from "@/lib/notifications/channel";
import type { ChannelView } from "@/lib/db/queries";
import {
  buttonClass,
  buttonGhostClass,
  cardClass,
  checkboxClass,
  errorClass,
  inputClass,
  labelClass,
  successClass,
} from "@/components/ui/classes";

function StateNote({ state }: Readonly<{ state: SettingsFormState }>) {
  const t = useTranslations("notifications");
  if (state.error) {
    const known = [
      "invalid",
      "invalidTimezone",
      "pushoverConfigMissing",
      "channelNotConfigured",
    ];
    return (
      <p className={errorClass}>
        {known.includes(state.error) ? t(`errors.${state.error}`) : state.error}
      </p>
    );
  }
  if (state.ok) {
    return <p className={successClass}>{t("saved")}</p>;
  }
  return null;
}

export function ProfileForm({
  user,
  settings,
}: Readonly<{ user: User; settings: UserSettings }>) {
  const t = useTranslations();
  const [state, action, pending] = useActionState<SettingsFormState, FormData>(
    updateProfile,
    {},
  );

  return (
    <form action={action} className={`${cardClass} flex flex-col gap-4`}>
      <StateNote state={state} />
      <div className="grid gap-3 sm:grid-cols-3">
        <label className={labelClass}>
          {t("auth.displayName")}
          <input
            name="displayName"
            required
            defaultValue={user.displayName}
            className={inputClass}
          />
        </label>
        <label className={labelClass}>
          {t("profile.language")}
          <select
            name="locale"
            defaultValue={settings.locale}
            className={inputClass}
          >
            <option value="en">English</option>
            <option value="da">Dansk</option>
            <option value="sv">Svenska</option>
            <option value="tlh">tlhIngan Hol</option>
          </select>
        </label>
        <label className={labelClass}>
          {t("profile.timezone")}
          <input
            name="timezone"
            required
            defaultValue={settings.timezone}
            className={inputClass}
          />
        </label>
      </div>
      <button
        type="submit"
        disabled={pending}
        className={`${buttonClass} self-start`}
      >
        {t("common.save")}
      </button>
    </form>
  );
}

export function SchedulingForm({
  settings,
}: Readonly<{ settings: UserSettings }>) {
  const t = useTranslations();
  const [state, action, pending] = useActionState<SettingsFormState, FormData>(
    updateSchedulingSettings,
    {},
  );
  const fields = [
    {
      name: "actionWindowDays",
      label: t("scheduling.windowDays"),
      value: settings.actionWindowDays,
      min: 1,
      max: 30,
    },
    {
      name: "jitterPct",
      label: t("scheduling.jitterPct"),
      value: settings.jitterPct,
      min: 0,
      max: 50,
    },
    {
      name: "defaultIntervalDays",
      label: t("scheduling.defaultInterval"),
      value: settings.defaultIntervalDays,
      min: 1,
      max: 730,
    },
    {
      name: "digestHour",
      label: t("scheduling.digestHour"),
      value: settings.digestHour,
      min: 0,
      max: 23,
    },
  ];

  return (
    <form action={action} className={`${cardClass} flex flex-col gap-4`}>
      <StateNote state={state} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {fields.map((field) => (
          // justify-between: labels wrap to different heights, inputs still align.
          <label key={field.name} className={`${labelClass} justify-between`}>
            {field.label}
            <input
              name={field.name}
              type="number"
              required
              min={field.min}
              max={field.max}
              defaultValue={field.value}
              className={inputClass}
            />
          </label>
        ))}
      </div>
      <button
        type="submit"
        disabled={pending}
        className={`${buttonClass} self-start`}
      >
        {t("common.save")}
      </button>
    </form>
  );
}

function TestButton({ channel }: Readonly<{ channel: ChannelId }>) {
  const t = useTranslations("notifications");
  const [result, setResult] = useState<SettingsFormState | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <span className="flex items-center gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setResult(await sendTestNotification(channel));
          setBusy(false);
        }}
        className={buttonGhostClass}
      >
        {t("sendTest")}
      </button>
      {result?.ok ? <span className={successClass}>{t("testOk")}</span> : null}
      {result?.error ? (
        <span
          className="max-w-60 truncate text-sm font-medium text-warn"
          title={result.error}
        >
          {result.error}
        </span>
      ) : null}
    </span>
  );
}

/** "Saved — leave blank to keep" once a secret exists, otherwise nothing. */
function secretPlaceholder(
  channel: ChannelView | null,
  key: string,
  t: ReturnType<typeof useTranslations<"notifications">>,
): string {
  return channel?.savedSecrets.includes(key) ? t("secretSaved") : "";
}

export function NotificationChannelsForm({
  pushover,
  email,
}: Readonly<{
  pushover: ChannelView | null;
  email: ChannelView | null;
}>) {
  const t = useTranslations("notifications");
  const [poState, poAction, poPending] = useActionState<
    SettingsFormState,
    FormData
  >(upsertNotificationChannel, {});
  const [emState, emAction, emPending] = useActionState<
    SettingsFormState,
    FormData
  >(upsertNotificationChannel, {});

  return (
    <div className="flex flex-col gap-3">
      <form action={poAction} className={`${cardClass} flex flex-col gap-4`}>
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-bold">{t("pushoverTitle")}</h3>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              name="enabled"
              defaultChecked={pushover?.enabled ?? false}
              className={checkboxClass}
            />
            {t("enabled")}
          </label>
        </div>
        <StateNote state={poState} />
        <input type="hidden" name="channel" value="pushover" />
        <div className="grid gap-3 sm:grid-cols-2">
          {/* Secrets are write-only: the server strips them, so these render
            blank and an empty submit keeps whatever is stored. */}
          <label className={labelClass}>
            {t("pushoverToken")}
            <input
              name="token"
              type="password"
              defaultValue=""
              placeholder={secretPlaceholder(pushover, "token", t)}
              className={inputClass}
              autoComplete="off"
            />
          </label>
          <label className={labelClass}>
            {t("pushoverUserKey")}
            <input
              name="userKey"
              type="password"
              defaultValue=""
              placeholder={secretPlaceholder(pushover, "userKey", t)}
              className={inputClass}
              autoComplete="off"
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" disabled={poPending} className={buttonClass}>
            {t("saveChannel")}
          </button>
          {pushover ? <TestButton channel="pushover" /> : null}
        </div>
      </form>

      <form action={emAction} className={`${cardClass} flex flex-col gap-4`}>
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-bold">{t("emailTitle")}</h3>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              name="enabled"
              defaultChecked={email?.enabled ?? false}
              className={checkboxClass}
            />
            {t("enabled")}
          </label>
        </div>
        <StateNote state={emState} />
        <input type="hidden" name="channel" value="email" />
        <label className={labelClass}>
          {t("emailAddress")}
          <input
            name="address"
            type="email"
            defaultValue={email?.config.address ?? ""}
            className={`${inputClass} sm:max-w-sm`}
          />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" disabled={emPending} className={buttonClass}>
            {t("saveChannel")}
          </button>
          {email ? <TestButton channel="email" /> : null}
        </div>
      </form>
    </div>
  );
}
