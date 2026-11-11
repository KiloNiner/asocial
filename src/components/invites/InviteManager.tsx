"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { createInvite, type InviteFormState } from "@/actions/invites";
import {
  createPasswordReset,
  type CreateResetState,
} from "@/actions/password-resets";
import { Icon } from "@/components/ui/Icon";
import {
  buttonClass,
  buttonQuietClass,
  cardClass,
  inputClass,
  labelClass,
} from "@/components/ui/classes";

/** A link that is shown exactly once, so it has to be easy to take away. */
function OneTimeLink({
  hint,
  url,
}: Readonly<{ hint: string; url: string }>) {
  return (
    <div className="rounded-xl border border-accent/30 bg-accent-soft p-3 text-sm">
      <p className="mb-1 font-bold text-accent-ink">{hint}</p>
      <code className="block select-all break-all font-mono text-xs text-accent-ink">
        {url}
      </code>
    </div>
  );
}

export function InviteCreateForm() {
  const t = useTranslations("invites");
  const [state, action, pending] = useActionState<InviteFormState, FormData>(
    createInvite,
    {},
  );

  return (
    <div className={`${cardClass} flex flex-col gap-3`}>
      <form action={action} className="flex flex-wrap items-end gap-2">
        <label className={`${labelClass} min-w-48 flex-1 sm:max-w-sm`}>
          {t("emailOptional")}
          <input name="email" type="email" className={inputClass} />
        </label>
        <button type="submit" disabled={pending} className={buttonClass}>
          <Icon name="plus" size={16} />
          {t("create")}
        </button>
      </form>
      {state.inviteUrl ? (
        <OneTimeLink hint={t("copyHint")} url={state.inviteUrl} />
      ) : null}
    </div>
  );
}

export function ResetPasswordButton({
  userId,
}: Readonly<{ userId: string }>) {
  const t = useTranslations("admin");
  const [state, setState] = useState<CreateResetState>({});
  const [pending, setPending] = useState(false);

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setState(await createPasswordReset(userId));
          setPending(false);
        }}
        className={`${buttonQuietClass} py-1`}
      >
        {t("resetPassword")}
      </button>
      {state.resetUrl ? (
        <div className="max-w-xs">
          <OneTimeLink hint={t("resetLinkHint")} url={state.resetUrl} />
        </div>
      ) : null}
      {state.error ? (
        <span className="text-xs font-medium text-warn">{state.error}</span>
      ) : null}
    </div>
  );
}

export function RevokeButton({
  inviteId,
  onRevoke,
  label,
}: Readonly<{
  inviteId: string;
  onRevoke: (id: string) => Promise<void>;
  /** Defaults to "Revoke"; pass e.g. the "remove" copy for used/expired rows. */
  label?: string;
}>) {
  const t = useTranslations("invites");
  return (
    <button
      type="button"
      onClick={() => onRevoke(inviteId)}
      className={`${buttonQuietClass} py-1 hover:text-danger`}
    >
      {label ?? t("revoke")}
    </button>
  );
}
