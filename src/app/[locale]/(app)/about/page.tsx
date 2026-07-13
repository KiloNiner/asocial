import { getFormatter, getTranslations } from "next-intl/server";
import { cardClass } from "@/components/ui/classes";
import pkg from "../../../../../package.json";

const MANUAL_TOPICS = [
  "circles",
  "scheduling",
  "activities",
  "views",
  "guiltFree",
  "journal",
  "birthdays",
  "notifications",
  "backup",
  "themes",
  "locales",
  "accounts",
] as const;

const linkClass = "text-accent hover:underline";

export default async function AboutPage() {
  const t = await getTranslations("about");
  const format = await getFormatter();

  const gitSha = process.env.GIT_SHA;
  const buildDate = process.env.BUILD_DATE;
  const hasBuildInfo = !!gitSha && gitSha !== "unknown";

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>

      <section className={`${cardClass} flex flex-col gap-2`}>
        <p className="text-sm">
          {t("version", { version: pkg.version })}
        </p>
        {hasBuildInfo ? (
          <p className="text-xs text-muted">
            {t("commit", { sha: gitSha!.slice(0, 7) })}
            {buildDate && buildDate !== "unknown"
              ? ` · ${t("buildDate", {
                  date: format.dateTime(new Date(buildDate), {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }),
                })}`
              : ""}
          </p>
        ) : (
          <p className="text-xs text-muted">{t("devBuild")}</p>
        )}
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <a
            href="https://github.com/KiloNiner/asocial"
            target="_blank"
            rel="noopener noreferrer"
            className={linkClass}
          >
            {t("links.github")}
          </a>
          <a
            href="https://github.com/KiloNiner/asocial/blob/main/CHANGELOG.md"
            target="_blank"
            rel="noopener noreferrer"
            className={linkClass}
          >
            {t("links.changelog")}
          </a>
          <a
            href="https://hub.docker.com/r/kiloniner/asocial"
            target="_blank"
            rel="noopener noreferrer"
            className={linkClass}
          >
            {t("links.dockerhub")}
          </a>
          <a
            href="https://github.com/KiloNiner/asocial/blob/main/LICENSE"
            target="_blank"
            rel="noopener noreferrer"
            className={linkClass}
          >
            {t("links.license", { license: pkg.license })}
          </a>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-medium">{t("manualTitle")}</h2>
        {MANUAL_TOPICS.map((key) => (
          <div key={key} className="flex flex-col gap-1">
            <h3 className="font-medium">{t(`manual.${key}.title`)}</h3>
            <p className="text-sm text-muted">{t(`manual.${key}.body`)}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
