import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { setFriendPref } from "@/actions/friends";
import { FriendForm } from "@/components/friends/FriendForm";
import { PrefEditor, type PrefRow } from "@/components/prefs/PrefEditor";
import { requireUserOrRedirect } from "@/lib/auth/current-user";
import * as q from "@/lib/db/queries";
import { governingCircle } from "@/lib/scheduler/interval";

export default async function EditFriendPage({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const user = await requireUserOrRedirect();
  const { id } = await params;
  const friend = q.getFriend(user.id, id);
  if (!friend) notFound();

  const t = await getTranslations("friends");
  const circles = q.getFriendCircles(user.id, id);
  const memberCircleIds = circles.map((c) => c.id);

  // Activity-preference weights: friend override, inheriting from the
  // governing circle, then user level, then the type default.
  const types = q
    .listContactTypes(user.id)
    .filter((type) => type.id !== "congratulate");
  const circlePrefs = (() => {
    const governing = governingCircle(friend, circles);
    return governing ? q.getCirclePrefs(user.id, governing.id) : new Map();
  })();
  const userPrefs = q.getUserPrefs(user.id);
  const friendPrefs = q.getFriendPrefs(user.id, id);
  const prefRows: PrefRow[] = types.map((type) => ({
    type: {
      id: type.id,
      name: type.name,
      emoji: type.emoji,
      defaultWeight: type.defaultWeight,
    },
    weight: friendPrefs.get(type.id) ?? null,
    inherited:
      circlePrefs.get(type.id) ?? userPrefs.get(type.id) ?? type.defaultWeight,
  }));

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">{t("editTitle")}</h1>
      <FriendForm
        friend={friend}
        allCircles={q.listCircles(user.id)}
        memberCircleIds={memberCircleIds}
        activityPrefs={
          <div className="flex flex-col gap-2 border-t border-line pt-4">
            <h2 className="text-sm font-medium text-muted">
              {t("typePrefs")}
            </h2>
            <PrefEditor
              rows={prefRows}
              action={setFriendPref.bind(null, friend.id)}
              hint={t("typePrefsHint")}
            />
          </div>
        }
      />
    </div>
  );
}
