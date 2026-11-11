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
  successClass,
} from "@/components/ui/classes";
import { Icon } from "@/components/ui/Icon";

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
      <a href="/api/backup" download className={`${buttonGhostClass} self-start`}>
        <Icon name="download" size={15} />
        {t("export")}
      </a>

      <form
        ref={formRef}
        action={action}
        onSubmit={(e) => {
          if (!confirm(t("replaceWarning"))) e.preventDefault();
        }}
        className="flex flex-col gap-3 border-t border-line pt-4"
      >
        <h3 className="font-bold">{t("importTitle")}</h3>
        {state.error ? (
          <p className={errorClass}>{t(`errors.${state.error}`)}</p>
        ) : null}
        {state.imported ? (
          <p className={successClass}>
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
            className={`${inputClass} text-sm file:mr-3 file:rounded-md file:border-0 file:bg-faint file:px-2.5 file:py-1 file:text-sm file:font-semibold file:text-ink`}
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
