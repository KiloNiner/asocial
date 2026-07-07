import { getTranslations } from "next-intl/server";

export default async function DashboardPage() {
  const t = await getTranslations();

  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold">{t("home.welcome")}</h1>
      <p className="text-stone-500">{t("app.tagline")}</p>
    </div>
  );
}
