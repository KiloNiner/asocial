"use client";

import { useTranslations } from "next-intl";
import { setFriendArchived } from "@/actions/friends";
import { buttonGhostClass } from "@/components/ui/classes";

export function ArchiveButton({
  friendId,
  archived,
}: Readonly<{ friendId: string; archived: boolean }>) {
  const t = useTranslations("friends");

  return (
    <button
      type="button"
      onClick={() => {
        if (archived || confirm(t("archiveConfirm"))) {
          void setFriendArchived(friendId, !archived);
        }
      }}
      className={buttonGhostClass}
    >
      {archived ? t("unarchive") : t("archive")}
    </button>
  );
}
