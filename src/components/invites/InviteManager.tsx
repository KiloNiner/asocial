"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { createInvite, type InviteFormState } from "@/actions/invites";

export function InviteCreateForm() {
  const t = useTranslations("invites");
  const [state, action, pending] = useActionState<InviteFormState, FormData>(
    createInvite,
    {},
  );

  return (
    <div className="flex flex-col gap-3">
      <form action={action} className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-sm">
          {t("emailOptional")}
          <input
            name="email"
            type="email"
            className="rounded-md border border-line bg-panel px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-on-accent hover:bg-accent-strong disabled:opacity-50"
        >
          {t("create")}
        </button>
      </form>
      {state.inviteUrl ? (
        <div className="rounded-md bg-accent-soft p-3 text-sm">
          <p className="mb-1 font-medium text-accent-ink">{t("copyHint")}</p>
          <code className="block break-all text-accent-ink">
            {state.inviteUrl}
          </code>
        </div>
      ) : null}
    </div>
  );
}

export function RevokeButton({
  inviteId,
  onRevoke,
}: Readonly<{
  inviteId: string;
  onRevoke: (id: string) => Promise<void>;
}>) {
  const t = useTranslations("invites");
  return (
    <button
      type="button"
      onClick={() => onRevoke(inviteId)}
      className="text-sm text-muted hover:text-danger hover:underline"
    >
      {t("revoke")}
    </button>
  );
}
