import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { FriendForm } from "@/components/friends/FriendForm";
import { requireUser } from "@/lib/auth/current-user";
import * as q from "@/lib/db/queries";

export default async function EditFriendPage({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const user = await requireUser();
  const { id } = await params;
  const friend = q.getFriend(user.id, id);
  if (!friend) notFound();

  const t = await getTranslations("friends");
  const memberCircleIds = q.getFriendCircles(user.id, id).map((c) => c.id);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">{t("editTitle")}</h1>
      <FriendForm
        friend={friend}
        allCircles={q.listCircles(user.id)}
        memberCircleIds={memberCircleIds}
      />
    </div>
  );
}
