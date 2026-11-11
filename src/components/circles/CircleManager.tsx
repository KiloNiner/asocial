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
import { Icon } from "@/components/ui/Icon";
import {
  buttonClass,
  buttonGhostClass,
  cardClass,
  errorClass,
  h2Class,
  hintClass,
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
    <div className="flex flex-wrap gap-2">
      <input type="hidden" name={name} value={selected} />
      {CIRCLE_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => setSelected(color)}
          aria-pressed={selected === color}
          className={`flex h-7 w-7 items-center justify-center rounded-full text-white transition hover:scale-110 ${
            selected === color
              ? "ring-2 ring-sel ring-offset-2 ring-offset-panel"
              : ""
          }`}
          style={{ backgroundColor: color }}
          aria-label={color}
        >
          {selected === color ? <Icon name="check" size={15} /> : null}
        </button>
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
          className={`${inputClass} w-32`}
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
    <form action={action} className={`${cardClass} flex flex-col gap-4`}>
      <div className="flex flex-col gap-1">
        <h2 className={h2Class}>{t("circles.createTitle")}</h2>
        <p className={hintClass}>{t("circles.examples")}</p>
      </div>
      {state.error ? (
        <p className={errorClass}>{t(`common.errors.${state.error}`)}</p>
      ) : null}
      <CircleFields />
      <button
        type="submit"
        disabled={pending}
        className={`${buttonClass} self-start`}
      >
        <Icon name="plus" size={16} />
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
    <div className={`${cardClass} flex flex-col gap-4`}>
      <div className="flex items-center gap-3">
        <span
          className="h-10 w-10 shrink-0 rounded-full"
          style={{
            backgroundColor: `color-mix(in srgb, ${circle.color} 22%, var(--t-panel))`,
            boxShadow: `inset 0 0 0 4px ${circle.color}`,
          }}
        />
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-bold">{circle.name}</span>
          <span className="text-sm text-muted">
            {t("common.everyNDays", { n: circle.intervalDays })} ·{" "}
            {t("circles.members", { n: memberCount })}
          </span>
        </div>
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
            <Icon name="pencil" size={15} />
            {t("common.edit")}
          </button>
          <button
            type="button"
            onClick={() => setShowPrefs((v) => !v)}
            aria-expanded={showPrefs}
            className={`${buttonGhostClass} ${showPrefs ? "bg-faint" : ""}`}
          >
            <Icon name="settings" size={15} />
            {t("circles.typePrefs")}
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirm(t("circles.deleteConfirm"))) {
                void deleteCircle(circle.id);
              }
            }}
            className={`${buttonGhostClass} ml-auto text-danger`}
          >
            <Icon name="trash" size={15} />
            {t("common.delete")}
          </button>
        </div>
      )}

      {showPrefs ? (
        <div className="border-t border-line pt-4">
          <PrefEditor
            rows={prefRows}
            action={setCirclePref.bind(null, circle.id)}
            hint={t("circles.typePrefsHint")}
          />
        </div>
      ) : null}
    </div>
  );
}
