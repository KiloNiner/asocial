"use client";

import { useActionState, useRef } from "react";
import { useFormatter, useTranslations } from "next-intl";
import {
  deleteInteraction,
  logInteraction,
  type InteractionFormState,
} from "@/actions/interactions";
import type { ContactType, Interaction } from "@/db/schema";
import { contactTypeLabel } from "@/lib/contact-type-label";
import {
  buttonClass,
  cardClass,
  errorClass,
  inputClass,
  labelClass,
} from "@/components/ui/classes";

type TypeInfo = Pick<ContactType, "id" | "name" | "emoji">;

export function LogInteractionForm({
  friendId,
  types,
  today,
}: Readonly<{ friendId: string; types: TypeInfo[]; today: string }>) {
  const t = useTranslations();
  const tTypes = useTranslations("contactTypes");
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<
    InteractionFormState,
    FormData
  >(async (prev, formData) => {
    const result = await logInteraction(prev, formData);
    if (!result.error) formRef.current?.reset();
    return result;
  }, {});

  return (
    <form
      ref={formRef}
      action={action}
      className={`${cardClass} flex flex-col gap-3`}
    >
      <h2 className="text-lg font-medium">{t("journal.logTitle")}</h2>
      {state.error ? (
        <p className={errorClass}>{t(`common.errors.${state.error}`)}</p>
      ) : null}
      <input type="hidden" name="friendId" value={friendId} />
      <div className="flex flex-wrap gap-2">
        <label className={labelClass}>
          {t("journal.what")}
          <select name="contactTypeId" required className={inputClass}>
            {types.map((type) => (
              <option key={type.id} value={type.id}>
                {`${type.emoji ?? ""} ${contactTypeLabel(type, tTypes)}`.trim()}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          {t("journal.when")}
          <input
            name="occurredOn"
            type="date"
            required
            defaultValue={today}
            max={today}
            className={inputClass}
          />
        </label>
      </div>
      <label className={labelClass}>
        {t("journal.note")}
        <textarea name="note" rows={2} maxLength={10000} className={inputClass} />
      </label>
      <button type="submit" disabled={pending} className={`${buttonClass} self-start`}>
        {t("journal.save")}
      </button>
    </form>
  );
}

export function JournalTimeline({
  friendId,
  entries,
  types,
}: Readonly<{
  friendId: string;
  entries: Interaction[];
  types: TypeInfo[];
}>) {
  const t = useTranslations();
  const tTypes = useTranslations("contactTypes");
  const format = useFormatter();
  const typeById = new Map(types.map((type) => [type.id, type]));

  if (entries.length === 0) {
    return <p className="text-sm text-muted">{t("journal.empty")}</p>;
  }

  return (
    <ul className="flex flex-col gap-0">
      {entries.map((entry) => {
        const type = typeById.get(entry.contactTypeId);
        return (
          <li
            key={entry.id}
            className="group relative border-l-2 border-line pb-4 pl-4"
          >
            <span className="absolute -left-[7px] top-1 h-3 w-3 rounded-full bg-dot" />
            <div className="flex items-baseline gap-2 text-sm">
              <span className="font-medium">
                {type
                  ? `${type.emoji ?? ""} ${contactTypeLabel(type, tTypes)}`.trim()
                  : entry.contactTypeId}
              </span>
              <span className="text-muted">
                {format.dateTime(new Date(`${entry.occurredOn}T12:00:00`), {
                  dateStyle: "medium",
                })}
              </span>
              <button
                type="button"
                onClick={() => {
                  if (confirm(t("journal.deleteConfirm"))) {
                    void deleteInteraction(entry.id, friendId);
                  }
                }}
                className="invisible ml-auto text-xs text-subtle hover:text-danger group-hover:visible"
              >
                {t("common.delete")}
              </button>
            </div>
            {entry.note ? (
              <p className="mt-1 whitespace-pre-wrap text-sm text-muted">
                {entry.note}
              </p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
