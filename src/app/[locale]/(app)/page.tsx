import { getLocale, getTranslations } from "next-intl/server";
import { ActionWindowBoard } from "@/components/board/ActionWindowBoard";
import { getSettings, requireUser } from "@/lib/auth/current-user";
import * as q from "@/lib/db/queries";
import { today } from "@/lib/scheduler/clock";

export default async function DashboardPage() {
  const user = await requireUser();
  const settings = await getSettings(user.id);
  const t = await getTranslations("dashboard");
  const locale = await getLocale();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted">{t("intro")}</p>
      </div>
      <ActionWindowBoard
        rows={q.boardRows(user.id)}
        types={q.listContactTypes(user.id)}
        today={today(settings.timezone)}
        locale={locale}
      />
    </div>
  );
}
