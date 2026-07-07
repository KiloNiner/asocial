import { getTranslations } from "next-intl/server";
import {
  CircleCard,
  CircleCreateForm,
} from "@/components/circles/CircleManager";
import type { PrefRow } from "@/components/prefs/PrefEditor";
import { requireUser } from "@/lib/auth/current-user";
import * as q from "@/lib/db/queries";

export default async function CirclesPage() {
  const user = await requireUser();
  const t = await getTranslations("circles");

  const circleList = q.listCircles(user.id);
  const memberCounts = q.circleMemberCounts(user.id);
  const types = q
    .listContactTypes(user.id)
    .filter((type) => type.id !== "congratulate");
  const userPrefs = q.getUserPrefs(user.id);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted">{t("intro")}</p>
      </div>

      {circleList.length === 0 ? (
        <p className="text-sm text-muted">{t("empty")}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {circleList.map((circle) => {
            const circlePrefs = q.getCirclePrefs(user.id, circle.id);
            const prefRows: PrefRow[] = types.map((type) => ({
              type: {
                id: type.id,
                name: type.name,
                emoji: type.emoji,
                defaultWeight: type.defaultWeight,
              },
              weight: circlePrefs.get(type.id) ?? null,
              inherited: userPrefs.get(type.id) ?? type.defaultWeight,
            }));
            return (
              <CircleCard
                key={circle.id}
                circle={circle}
                memberCount={memberCounts.get(circle.id) ?? 0}
                prefRows={prefRows}
              />
            );
          })}
        </div>
      )}

      <CircleCreateForm />
    </div>
  );
}
