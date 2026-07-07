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
import {
  buttonClass,
  buttonGhostClass,
  cardClass,
  errorClass,
  inputClass,
  labelClass,
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
    return <p className="text-sm text-accent">{t("saved")}</p>;
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
    <form action={action} className={`${cardClass} flex flex-wrap items-end gap-3`}>
      <h2 className="w-full text-lg font-medium">{t("profile.title")}</h2>
      <StateNote state={state} />
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
        <select name="locale" defaultValue={settings.locale} className={inputClass}>
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
      <button type="submit" disabled={pending} className={buttonClass}>
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
    { name: "actionWindowDays", label: t("scheduling.windowDays"), value: settings.actionWindowDays, min: 1, max: 30 },
    { name: "jitterPct", label: t("scheduling.jitterPct"), value: settings.jitterPct, min: 0, max: 50 },
    { name: "defaultIntervalDays", label: t("scheduling.defaultInterval"), value: settings.defaultIntervalDays, min: 1, max: 730 },
    { name: "digestHour", label: t("scheduling.digestHour"), value: settings.digestHour, min: 0, max: 23 },
  ];

  return (
    <form action={action} className={`${cardClass} flex flex-wrap items-end gap-3`}>
      <h2 className="w-full text-lg font-medium">{t("scheduling.title")}</h2>
      <StateNote state={state} />
      {fields.map((field) => (
        <label key={field.name} className={labelClass}>
          {field.label}
          <input
            name={field.name}
            type="number"
            required
            min={field.min}
            max={field.max}
            defaultValue={field.value}
            className={`${inputClass} w-28`}
          />
        </label>
      ))}
      <button type="submit" disabled={pending} className={buttonClass}>
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
      {result?.ok ? (
        <span className="text-sm text-accent">{t("testOk")}</span>
      ) : null}
      {result?.error ? (
        <span className="max-w-60 truncate text-sm text-warn" title={result.error}>
          {result.error}
        </span>
      ) : null}
    </span>
  );
}

export function NotificationChannelsForm({
  pushover,
  email,
}: Readonly<{
  pushover: { enabled: boolean; config: Record<string, string> } | null;
  email: { enabled: boolean; config: Record<string, string> } | null;
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
      <p className="text-sm text-muted">{t("intro")}</p>

      <form action={poAction} className={`${cardClass} flex flex-wrap items-end gap-3`}>
        <h3 className="w-full text-sm font-medium text-muted">
          {t("pushoverTitle")}
        </h3>
        <StateNote state={poState} />
        <input type="hidden" name="channel" value="pushover" />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="enabled"
            defaultChecked={pushover?.enabled ?? false}
            className="h-4 w-4 accent-accent"
          />
          {t("enabled")}
        </label>
        <label className={labelClass}>
          {t("pushoverToken")}
          <input
            name="token"
            defaultValue={pushover?.config.token ?? ""}
            className={inputClass}
            autoComplete="off"
          />
        </label>
        <label className={labelClass}>
          {t("pushoverUserKey")}
          <input
            name="userKey"
            defaultValue={pushover?.config.userKey ?? ""}
            className={inputClass}
            autoComplete="off"
          />
        </label>
        <button type="submit" disabled={poPending} className={buttonClass}>
          {t("saveChannel")}
        </button>
        {pushover ? <TestButton channel="pushover" /> : null}
      </form>

      <form action={emAction} className={`${cardClass} flex flex-wrap items-end gap-3`}>
        <h3 className="w-full text-sm font-medium text-muted">
          {t("emailTitle")}
        </h3>
        <StateNote state={emState} />
        <input type="hidden" name="channel" value="email" />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="enabled"
            defaultChecked={email?.enabled ?? false}
            className="h-4 w-4 accent-accent"
          />
          {t("enabled")}
        </label>
        <label className={labelClass}>
          {t("emailAddress")}
          <input
            name="address"
            type="email"
            defaultValue={email?.config.address ?? ""}
            className={`${inputClass} w-64`}
          />
        </label>
        <button type="submit" disabled={emPending} className={buttonClass}>
          {t("saveChannel")}
        </button>
        {email ? <TestButton channel="email" /> : null}
      </form>
    </div>
  );
}
