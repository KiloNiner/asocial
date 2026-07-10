"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { login, register, type AuthFormState } from "@/actions/auth";
import {
  completePasswordReset,
  type CompleteResetState,
} from "@/actions/password-resets";
import { Link } from "@/i18n/navigation";

// text-base, not text-sm: keeps iOS Safari from auto-zooming on focus (see
// components/ui/classes.ts for why that zoom never resets on redirect).
const inputClass =
  "w-full rounded-md border border-field-border bg-field px-3 py-2 text-base " +
  "focus:outline-none focus:ring-2 focus:ring-accent";

const buttonClass =
  "w-full rounded-md bg-accent px-3 py-2 text-sm font-medium text-on-accent " +
  "hover:bg-accent-strong disabled:opacity-50";

function ErrorNote({ error }: Readonly<{ error?: string }>) {
  const t = useTranslations("auth.errors");
  if (!error) return null;
  return (
    <p className="rounded-md bg-warn-soft px-3 py-2 text-sm text-warn">
      {t(error)}
    </p>
  );
}

export function LoginForm() {
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState<AuthFormState, FormData>(
    login,
    {},
  );

  return (
    <form action={action} className="flex flex-col gap-3">
      <ErrorNote error={state.error} />
      <label className="flex flex-col gap-1 text-sm">
        {t("email")}
        <input name="email" type="email" required className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
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
}: Readonly<{ invite?: string; bootstrap: boolean }>) {
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState<AuthFormState, FormData>(
    register,
    {},
  );

  return (
    <form action={action} className="flex flex-col gap-3">
      <ErrorNote error={state.error} />
      <p className="text-sm text-muted">
        {bootstrap ? t("bootstrapHint") : t("inviteNeededHint")}
      </p>
      {invite ? <input type="hidden" name="invite" value={invite} /> : null}
      <label className="flex flex-col gap-1 text-sm">
        {t("displayName")}
        <input name="displayName" required className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        {t("email")}
        <input name="email" type="email" required className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
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
        <p className="text-sm text-accent">{t("resetDone")}</p>
        <Link href="/login" className="text-sm text-accent hover:underline">
          {t("haveAccount")}
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      <ErrorNote error={state.error} />
      <input type="hidden" name="token" value={token} />
      <label className="flex flex-col gap-1 text-sm">
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
