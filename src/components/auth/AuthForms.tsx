"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { login, register, type AuthFormState } from "@/actions/auth";

const inputClass =
  "w-full rounded-md border border-line bg-panel px-3 py-2 text-sm " +
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
