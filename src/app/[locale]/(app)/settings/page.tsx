import { getFormatter, getTranslations } from "next-intl/server";
import {
  NotificationChannelsForm,
  ProfileForm,
  SchedulingForm,
} from "@/components/settings/SettingsForms";
import { BackupCard } from "@/components/settings/BackupCard";
import { StartFreshCard } from "@/components/settings/StartFreshCard";
import { ThemeSelector } from "@/components/settings/ThemeSelector";
import { TypesManager } from "@/components/settings/TypesManager";
import {
  eyebrowClass,
  h1Class,
  h2Class,
  listClass,
} from "@/components/ui/classes";
import { getSettings, requireUserOrRedirect } from "@/lib/auth/current-user";
import * as q from "@/lib/db/queries";
import { contactBacklog } from "@/lib/scheduler/reset";
import { isThemeChoice, type ThemeChoice } from "@/lib/themes";

export default async function SettingsPage() {
  const user = await requireUserOrRedirect();
  const settings = await getSettings(user.id);
  const t = await getTranslations();
  const format = await getFormatter();

  const types = q.listContactTypes(user.id, { includeArchived: true });
  const userPrefs = Object.fromEntries(q.getUserPrefs(user.id));
  const channels = q.getNotificationChannels(user.id);
  const log = q.listNotificationLog(user.id);

  const sections = [
    { id: "profile", label: t("profile.title") },
    { id: "appearance", label: t("appearance.title") },
    { id: "scheduling", label: t("scheduling.title") },
    { id: "notifications", label: t("notifications.title") },
    { id: "types", label: t("settings.typesTitle") },
    { id: "start-fresh", label: t("startFresh.title") },
    { id: "backup", label: t("backup.title") },
  ] as const;
  const label = Object.fromEntries(sections.map((s) => [s.id, s.label]));

  return (
    <div className="flex flex-col gap-6">
      <h1 className={h1Class}>{t("settings.title")}</h1>

      <div className="grid gap-x-10 gap-y-4 lg:grid-cols-[11rem_minmax(0,1fr)] lg:items-start">
        {/* Jump list: a sticky strip on small screens, a side rail on wide. */}
        <nav
          aria-label={t("settings.title")}
          className="sticky top-[57px] z-20 -mx-4 flex gap-1 overflow-x-auto border-b border-line bg-surface/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6 md:top-0 lg:top-9 lg:mx-0 lg:flex-col lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none"
        >
          {sections.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className="shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-faint hover:text-ink"
            >
              {section.label}
            </a>
          ))}
        </nav>

        <div className="flex max-w-2xl flex-col gap-10">
          <Section id="profile" title={label.profile}>
            <ProfileForm user={user} settings={settings} />
          </Section>

          <Section id="appearance" title={label.appearance}>
            <ThemeSelector
              current={
                isThemeChoice(settings.theme)
                  ? (settings.theme as ThemeChoice)
                  : "auto"
              }
            />
          </Section>

          <Section id="scheduling" title={label.scheduling}>
            <SchedulingForm settings={settings} />
          </Section>

          <Section
            id="notifications"
            title={label.notifications}
            intro={t("notifications.intro")}
          >
            <NotificationChannelsForm
              pushover={channels.get("pushover") ?? null}
              email={channels.get("email") ?? null}
            />
            <h3 className={`${eyebrowClass} mt-2`}>
              {t("notifications.logTitle")}
            </h3>
            {log.length === 0 ? (
              <p className="text-sm text-muted">{t("notifications.logEmpty")}</p>
            ) : (
              <ul className={`${listClass} text-sm`}>
                {log.map((entry) => (
                  <li key={entry.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="w-20 font-semibold">{entry.channel}</span>
                    <span className="text-muted">
                      {format.dateTime(new Date(entry.sentAt), {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </span>
                    <span
                      className={`ml-auto rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        entry.status === "sent"
                          ? "bg-accent-soft text-accent-ink"
                          : "bg-warn-soft text-warn"
                      }`}
                      title={entry.error ?? undefined}
                    >
                      {entry.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section id="types" title={label.types} intro={t("settings.typesIntro")}>
            <TypesManager types={types} userPrefs={userPrefs} />
          </Section>

          <Section
            id="start-fresh"
            title={label["start-fresh"]}
            intro={t("startFresh.intro")}
          >
            <StartFreshCard
              open={contactBacklog(user.id, settings.timezone).open}
            />
          </Section>

          <Section id="backup" title={label.backup} intro={t("backup.intro")}>
            <BackupCard />
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({
  id,
  title,
  intro,
  children,
}: Readonly<{
  id: string;
  title: string;
  intro?: string;
  children: React.ReactNode;
}>) {
  return (
    // scroll-mt clears whichever sticky bar sits above at this width.
    <section id={id} className="flex scroll-mt-28 flex-col gap-3 lg:scroll-mt-9">
      <div className="flex flex-col gap-1">
        <h2 className={h2Class}>{title}</h2>
        {intro ? <p className="text-sm text-muted">{intro}</p> : null}
      </div>
      {children}
    </section>
  );
}
