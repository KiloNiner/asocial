"use client";

import { useActionState, useRef } from "react";
import { useTranslations } from "next-intl";
import { importBackup, type BackupFormState } from "@/actions/backup";
import {
  buttonClass,
  buttonGhostClass,
  cardClass,
  errorClass,
  inputClass,
  labelClass,
} from "@/components/ui/classes";

export function BackupCard() {
  const t = useTranslations("backup");
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<BackupFormState, FormData>(
    async (prev, formData) => {
      const result = await importBackup(prev, formData);
      if (result.imported) formRef.current?.reset();
      return result;
    },
    {},
  );

  return (
    <div className={`${cardClass} flex flex-col gap-4`}>
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-medium">{t("title")}</h2>
        <p className="text-sm text-muted">{t("intro")}</p>
      </div>

      <a href="/api/backup" download className={`${buttonGhostClass} self-start`}>
        {t("export")}
      </a>

      <form
        ref={formRef}
        action={action}
        onSubmit={(e) => {
          if (!confirm(t("replaceWarning"))) e.preventDefault();
        }}
        className="flex flex-col gap-2 border-t border-line pt-4"
      >
        <h3 className="text-sm font-medium">{t("importTitle")}</h3>
        {state.error ? (
          <p className={errorClass}>{t(`errors.${state.error}`)}</p>
        ) : null}
        {state.imported ? (
          <p className="text-sm text-accent">
            {t("imported", {
              friends: state.imported.friends,
              circles: state.imported.circles,
              interactions: state.imported.interactions,
            })}
          </p>
        ) : null}
        <label className={labelClass}>
          {t("file")}
          <input
            type="file"
            name="file"
            accept="application/json,.json"
            required
            className={`${inputClass} file:mr-3 file:rounded file:border-0 file:bg-faint file:px-2 file:py-1 file:text-sm`}
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className={`${buttonClass} self-start`}
        >
          {t("import")}
        </button>
      </form>
    </div>
  );
}
