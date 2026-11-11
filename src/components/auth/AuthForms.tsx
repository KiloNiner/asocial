"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { login, register, type AuthFormState } from "@/actions/auth";
import {
  completePasswordReset,
  type CompleteResetState,
} from "@/actions/password-resets";
import {
  buttonClass as baseButtonClass,
  errorClass,
  hintClass,
  inputClass as baseInputClass,
  labelClass,
  linkClass,
  successClass,
} from "@/components/ui/classes";
import { Link } from "@/i18n/navigation";

const inputClass = `${baseInputClass} w-full`;
const buttonClass = `${baseButtonClass} w-full`;

function ErrorNote({ error }: Readonly<{ error?: string }>) {
  const t = useTranslations("auth.errors");
  if (!error) return null;
  return (
    <p className={errorClass}>{t(error)}</p>
  );
}

export function LoginForm() {
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState<AuthFormState, FormData>(
    login,
    {},
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <ErrorNote error={state.error} />
      <label className={labelClass}>
        {t("email")}
        <input name="email" type="email" required className={inputClass} />
      </label>
      <label className={labelClass}>
        {t("password")}
        <input
          name="password"
          type="password"
          required
          className={inputClass}
        />
      </label>
      <button type="submit" disabled={pending} className={buttonClass}>
        {t("login")}
      </button>
    </form>
  );
}

export function RegisterForm({
  invite,
  bootstrap,
  emailDigest,
}: Readonly<{ invite?: string; bootstrap: boolean; emailDigest: boolean }>) {
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState<AuthFormState, FormData>(
    register,
    {},
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <ErrorNote error={state.error} />
      <p className="text-sm text-muted">
        {bootstrap ? t("bootstrapHint") : t("inviteNeededHint")}
      </p>
      {invite ? <input type="hidden" name="invite" value={invite} /> : null}
      <label className={labelClass}>
        {t("displayName")}
        <input name="displayName" required className={inputClass} />
      </label>
      <label className={labelClass}>
        {t("email")}
        <input name="email" type="email" required className={inputClass} />
        {emailDigest ? (
          <span className={hintClass}>{t("digestHint")}</span>
        ) : null}
      </label>
      <label className={labelClass}>
        {t("password")}
        <input
          name="password"
          type="password"
          required
          minLength={10}
          className={inputClass}
        />
      </label>
      <button type="submit" disabled={pending} className={buttonClass}>
        {t("register")}
      </button>
    </form>
  );
}

export function ResetPasswordForm({ token }: Readonly<{ token: string }>) {
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState<
    CompleteResetState,
    FormData
  >(completePasswordReset, {});

  if (state.ok) {
    return (
      <div className="flex flex-col gap-2">
        <p className={successClass}>{t("resetDone")}</p>
        <Link href="/login" className={`${linkClass} text-sm`}>
          {t("haveAccount")}
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <ErrorNote error={state.error} />
      <input type="hidden" name="token" value={token} />
      <label className={labelClass}>
        {t("newPassword")}
        <input
          name="password"
          type="password"
          required
          minLength={10}
          className={inputClass}
        />
      </label>
      <button type="submit" disabled={pending} className={buttonClass}>
        {t("resetSubmit")}
      </button>
    </form>
  );
}
