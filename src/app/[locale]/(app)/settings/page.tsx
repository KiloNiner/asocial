import { getTranslations } from "next-intl/server";
import { TypesManager } from "@/components/settings/TypesManager";
import { requireUser } from "@/lib/auth/current-user";
import * as q from "@/lib/db/queries";

export default async function SettingsPage() {
  const user = await requireUser();
  const t = await getTranslations("settings");

  const types = q.listContactTypes(user.id, { includeArchived: true });
  const userPrefs = Object.fromEntries(q.getUserPrefs(user.id));

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">{t("typesTitle")}</h2>
        <TypesManager types={types} userPrefs={userPrefs} />
      </section>
    </div>
  );
}
