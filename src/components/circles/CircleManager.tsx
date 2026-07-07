"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import {
  createCircle,
  deleteCircle,
  setCirclePref,
  updateCircle,
  type CircleFormState,
} from "@/actions/circles";
import type { Circle } from "@/db/schema";
import { CIRCLE_COLORS } from "@/lib/colors";
import {
  buttonClass,
  buttonGhostClass,
  cardClass,
  errorClass,
  inputClass,
  labelClass,
} from "@/components/ui/classes";
import { PrefEditor, type PrefRow } from "@/components/prefs/PrefEditor";

function ColorPicker({
  name,
  defaultValue,
}: Readonly<{ name: string; defaultValue?: string }>) {
  const [selected, setSelected] = useState(defaultValue ?? CIRCLE_COLORS[0]);
  return (
    <div className="flex flex-wrap gap-1.5">
      <input type="hidden" name={name} value={selected} />
      {CIRCLE_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => setSelected(color)}
          className={`h-7 w-7 rounded-full border-2 ${
            selected === color ? "border-stone-800" : "border-transparent"
          }`}
          style={{ backgroundColor: color }}
          aria-label={color}
        />
      ))}
    </div>
  );
}

function CircleFields({ circle }: Readonly<{ circle?: Circle }>) {
  const t = useTranslations();
  return (
    <>
      <label className={labelClass}>
        {t("circles.name")}
        <input
          name="name"
          required
          maxLength={60}
          defaultValue={circle?.name}
          className={inputClass}
        />
      </label>
      <label className={labelClass}>
        {t("circles.interval")} ({t("common.days")})
        <input
          name="intervalDays"
          type="number"
          required
          min={1}
          max={730}
          defaultValue={circle?.intervalDays ?? 30}
          className={inputClass}
        />
      </label>
      <div className={labelClass}>
        {t("circles.color")}
        <ColorPicker name="color" defaultValue={circle?.color} />
      </div>
    </>
  );
}

export function CircleCreateForm() {
  const t = useTranslations();
  const [state, action, pending] = useActionState<CircleFormState, FormData>(
    createCircle,
    {},
  );

  return (
    <form action={action} className={`${cardClass} flex flex-col gap-3`}>
      <h2 className="text-lg font-medium">{t("circles.createTitle")}</h2>
      <p className="text-xs text-stone-500">{t("circles.examples")}</p>
      {state.error ? (
        <p className={errorClass}>{t(`common.errors.${state.error}`)}</p>
      ) : null}
      <CircleFields />
      <button type="submit" disabled={pending} className={buttonClass}>
        {t("common.create")}
      </button>
    </form>
  );
}

export function CircleCard({
  circle,
  memberCount,
  prefRows,
}: Readonly<{
  circle: Circle;
  memberCount: number;
  prefRows: PrefRow[];
}>) {
  const t = useTranslations();
  const [editing, setEditing] = useState(false);
  const [showPrefs, setShowPrefs] = useState(false);
  const boundUpdate = updateCircle.bind(null, circle.id);
  const [state, action, pending] = useActionState<CircleFormState, FormData>(
    async (prev, formData) => {
      const result = await boundUpdate(prev, formData);
      if (!result.error) setEditing(false);
      return result;
    },
    {},
  );

  return (
    <div className={`${cardClass} flex flex-col gap-3`}>
      <div className="flex items-center gap-2">
        <span
          className="h-4 w-4 shrink-0 rounded-full"
          style={{ backgroundColor: circle.color }}
        />
        <span className="font-medium">{circle.name}</span>
        <span className="ml-auto text-sm text-stone-500">
          {t("common.everyNDays", { n: circle.intervalDays })} ·{" "}
          {t("circles.members", { n: memberCount })}
        </span>
      </div>

      {editing ? (
        <form action={action} className="flex flex-col gap-3">
          {state.error ? (
            <p className={errorClass}>{t(`common.errors.${state.error}`)}</p>
          ) : null}
          <CircleFields circle={circle} />
          <div className="flex gap-2">
            <button type="submit" disabled={pending} className={buttonClass}>
              {t("common.save")}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className={buttonGhostClass}
            >
              {t("common.cancel")}
            </button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className={buttonGhostClass}
          >
            {t("common.edit")}
          </button>
          <button
            type="button"
            onClick={() => setShowPrefs((v) => !v)}
            className={buttonGhostClass}
          >
            {t("circles.typePrefs")}
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirm(t("circles.deleteConfirm"))) {
                void deleteCircle(circle.id);
              }
            }}
            className={`${buttonGhostClass} text-red-700`}
          >
            {t("common.delete")}
          </button>
        </div>
      )}

      {showPrefs ? (
        <PrefEditor
          rows={prefRows}
          action={setCirclePref.bind(null, circle.id)}
          hint={t("circles.typePrefsHint")}
        />
      ) : null}
    </div>
  );
}
