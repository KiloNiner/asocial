"use client";

import { useActionState, useRef } from "react";
import { useTranslations } from "next-intl";
import {
  createCustomContactType,
  setContactTypeArchived,
  setUserContactPref,
  type ContactTypeFormState,
} from "@/actions/contact-types";
import type { ContactType } from "@/db/schema";
import { contactTypeLabel } from "@/lib/contact-type-label";
import { Icon } from "@/components/ui/Icon";
import {
  buttonClass,
  buttonQuietClass,
  cardClass,
  errorClass,
  eyebrowClass,
  inputClass,
  listClass,
} from "@/components/ui/classes";

export function TypesManager({
  types,
  userPrefs,
}: Readonly<{
  types: ContactType[];
  userPrefs: Record<string, number>;
}>) {
  const t = useTranslations("settings");
  const tTypes = useTranslations("contactTypes");
  const builtin = types.filter((type) => !type.userId);
  const custom = types.filter((type) => type.userId);

  return (
    <div className="flex flex-col gap-4">
      <TypeGroup
        title={t("builtin")}
        types={builtin.filter((type) => type.id !== "congratulate")}
        userPrefs={userPrefs}
        labelOf={(type) => contactTypeLabel(type, tTypes)}
      />

      {custom.length > 0 ? (
        <TypeGroup
          title={t("custom")}
          types={custom}
          userPrefs={userPrefs}
          labelOf={(type) => contactTypeLabel(type, tTypes)}
          archivable
        />
      ) : null}

      <CreateTypeForm />
    </div>
  );
}

function TypeGroup({
  title,
  types,
  userPrefs,
  labelOf,
  archivable,
}: Readonly<{
  title: string;
  types: ContactType[];
  userPrefs: Record<string, number>;
  labelOf: (type: ContactType) => string;
  archivable?: boolean;
}>) {
  const t = useTranslations("settings");

  return (
    <section className="flex flex-col gap-2">
      <h3 className={eyebrowClass}>{title}</h3>
      <ul className={listClass}>
        {types.map((type) => (
          <li key={type.id} className="flex items-center gap-3 px-4 py-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-faint text-lg">
              {type.emoji}
            </span>
            <span
              className={`min-w-0 text-sm font-semibold ${type.archived ? "text-subtle line-through" : ""}`}
            >
              {labelOf(type)}
              {type.archived ? (
                <span className="ml-2 inline-block text-xs font-normal">
                  ({t("archivedTag")})
                </span>
              ) : null}
            </span>
            <div className="ml-auto flex items-center gap-3">
              <WeightField
                typeId={type.id}
                weight={userPrefs[type.id] ?? null}
                defaultWeight={type.defaultWeight}
              />
              {archivable ? (
                <button
                  type="button"
                  onClick={() =>
                    void setContactTypeArchived(type.id, !type.archived)
                  }
                  className={`${buttonQuietClass} px-1 py-1 text-xs`}
                >
                  {type.archived ? t("restore") : t("archive")}
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function WeightField({
  typeId,
  weight,
  defaultWeight,
}: Readonly<{ typeId: string; weight: number | null; defaultWeight: number }>) {
  const t = useTranslations("settings");
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={setUserContactPref} className="flex items-center gap-2">
      <input type="hidden" name="contactTypeId" value={typeId} />
      <label className="flex items-center gap-2 text-xs font-medium text-muted">
        {t("typeWeight")}
        <input
          name="weight"
          type="number"
          min={0}
          max={100}
          defaultValue={weight ?? ""}
          placeholder={String(defaultWeight)}
          title={t("typeWeightHint", { n: defaultWeight })}
          className={`${inputClass} w-20`}
          onBlur={(e) => {
            const prev = weight === null ? "" : String(weight);
            if (e.currentTarget.value !== prev) {
              formRef.current?.requestSubmit();
            }
          }}
        />
      </label>
    </form>
  );
}

function CreateTypeForm() {
  const t = useTranslations("settings");
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<
    ContactTypeFormState,
    FormData
  >(async (prev, formData) => {
    const result = await createCustomContactType(prev, formData);
    if (!result.error) formRef.current?.reset();
    return result;
  }, {});
  const tCommon = useTranslations("common");

  return (
    <form
      ref={formRef}
      action={action}
      className={`${cardClass} flex flex-wrap items-end gap-3`}
    >
      <h3 className="w-full font-bold">{t("addType")}</h3>
      {state.error ? (
        <p className={`${errorClass} w-full`}>
          {tCommon(`errors.${state.error}`)}
        </p>
      ) : null}
      <label className="flex flex-col gap-1 text-xs font-medium text-muted">
        {t("typeEmoji")}
        <input name="emoji" maxLength={32} className={`${inputClass} w-16`} />
      </label>
      <label className="flex min-w-40 flex-1 flex-col gap-1 text-xs font-medium text-muted">
        {t("typeName")}
        <input name="name" required maxLength={60} className={`${inputClass} w-full`} />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-muted">
        {t("typeWeight")}
        <input
          name="defaultWeight"
          type="number"
          required
          min={0}
          max={100}
          defaultValue={15}
          className={`${inputClass} w-20`}
        />
      </label>
      <button type="submit" disabled={pending} className={buttonClass}>
        <Icon name="plus" size={16} />
        {tCommon("create")}
      </button>
    </form>
  );
}
