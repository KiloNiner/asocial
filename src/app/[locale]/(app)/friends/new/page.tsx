import { getTranslations } from "next-intl/server";
import { FriendForm } from "@/components/friends/FriendForm";
import { requireUserOrRedirect } from "@/lib/auth/current-user";
import * as q from "@/lib/db/queries";

export default async function NewFriendPage() {
  const user = await requireUserOrRedirect();
  const t = await getTranslations("friends");

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">{t("newTitle")}</h1>
      <FriendForm allCircles={q.listCircles(user.id)} />
    </div>
  );
}
