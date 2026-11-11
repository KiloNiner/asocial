import { getFormatter, getTranslations } from "next-intl/server";
import Image from "next/image";
import {
  cardClass,
  h1Class,
  h2Class,
  linkClass,
} from "@/components/ui/classes";
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

export default async function AboutPage() {
  const t = await getTranslations("about");
  const tApp = await getTranslations("app");
  const format = await getFormatter();

  const gitSha = process.env.GIT_SHA;
  const buildDate = process.env.BUILD_DATE;
  const hasBuildInfo = !!gitSha && gitSha !== "unknown";

  const links = [
    { href: "https://github.com/KiloNiner/asocial", label: t("links.github") },
    {
      href: "https://github.com/KiloNiner/asocial/blob/main/CHANGELOG.md",
      label: t("links.changelog"),
    },
    {
      href: "https://hub.docker.com/r/kiloniner/asocial",
      label: t("links.dockerhub"),
    },
    {
      href: "https://github.com/KiloNiner/asocial/blob/main/LICENSE",
      label: t("links.license", { license: pkg.license }),
    },
  ];

  return (
    <div className="flex flex-col gap-10">
      <h1 className={h1Class}>{t("title")}</h1>

      <section
        className={`${cardClass} flex max-w-3xl flex-col gap-4 sm:flex-row sm:items-center sm:gap-5`}
      >
        <Image src="/mark.svg" alt="" width={56} height={56} className="shrink-0" />
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-lg font-extrabold tracking-tight">
            {t("version", { version: pkg.version })}
          </p>
          <p className="text-sm text-muted">{tApp("tagline")}</p>
          {hasBuildInfo ? (
            <p className="text-xs text-subtle">
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
            <p className="text-xs text-subtle">{t("devBuild")}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className={linkClass}
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className={h2Class}>{t("manualTitle")}</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {MANUAL_TOPICS.map((key) => (
            <div key={key} className={`${cardClass} flex flex-col gap-1.5`}>
              <h3 className="font-bold">{t(`manual.${key}.title`)}</h3>
              <p className="text-sm leading-relaxed text-muted">
                {t(`manual.${key}.body`)}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
