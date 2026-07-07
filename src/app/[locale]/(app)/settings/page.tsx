import { getFormatter, getTranslations } from "next-intl/server";
import {
  NotificationChannelsForm,
  ProfileForm,
  SchedulingForm,
} from "@/components/settings/SettingsForms";
import { BackupCard } from "@/components/settings/BackupCard";
import { ThemeSelector } from "@/components/settings/ThemeSelector";
import { TypesManager } from "@/components/settings/TypesManager";
import { getSettings, requireUser } from "@/lib/auth/current-user";
import * as q from "@/lib/db/queries";
import { isThemeChoice, type ThemeChoice } from "@/lib/themes";

export default async function SettingsPage() {
  const user = await requireUser();
  const settings = await getSettings(user.id);
  const t = await getTranslations();
  const format = await getFormatter();

  const types = q.listContactTypes(user.id, { includeArchived: true });
  const userPrefs = Object.fromEntries(q.getUserPrefs(user.id));
  const channels = q.getNotificationChannels(user.id);
  const log = q.listNotificationLog(user.id);

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <h1 className="text-2xl font-semibold">{t("settings.title")}</h1>

      <ProfileForm user={user} settings={settings} />
      <ThemeSelector
        current={
          isThemeChoice(settings.theme)
            ? (settings.theme as ThemeChoice)
            : "auto"
        }
      />
      <SchedulingForm settings={settings} />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">{t("notifications.title")}</h2>
        <NotificationChannelsForm
          pushover={channels.get("pushover") ?? null}
          email={channels.get("email") ?? null}
        />
        <h3 className="text-sm font-medium text-muted">
          {t("notifications.logTitle")}
        </h3>
        {log.length === 0 ? (
          <p className="text-sm text-muted">{t("notifications.logEmpty")}</p>
        ) : (
          <ul className="divide-y divide-line rounded-md border border-line bg-panel text-sm">
            {log.map((entry) => (
              <li key={entry.id} className="flex items-center gap-3 px-4 py-2">
                <span className="w-20 font-medium">{entry.channel}</span>
                <span className="text-muted">
                  {format.dateTime(new Date(entry.sentAt), {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </span>
                <span
                  className={`ml-auto ${
                    entry.status === "sent" ? "text-accent" : "text-warn"
                  }`}
                  title={entry.error ?? undefined}
                >
                  {entry.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">{t("settings.typesTitle")}</h2>
        <TypesManager types={types} userPrefs={userPrefs} />
      </section>

      <BackupCard />
    </div>
  );
}
