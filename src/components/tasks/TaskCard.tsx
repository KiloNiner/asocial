"use client";

import { useActionState, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import {
  completeTask,
  createManualTask,
  rescheduleTask,
  skipTask,
  snoozeTask,
  type TaskFormState,
} from "@/actions/tasks";
import type { ContactType, Task } from "@/db/schema";
import { contactTypeLabel } from "@/lib/contact-type-label";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import {
  buttonClass,
  buttonGhostClass,
  buttonQuietClass,
  cardClass,
  errorClass,
  h2Class,
  inputClass,
  labelClass,
} from "@/components/ui/classes";
import { Link } from "@/i18n/navigation";
import { windowState, type WindowState } from "@/lib/scheduler/window-state";

export type TypeInfo = Pick<ContactType, "id" | "name" | "emoji">;

function typeText(
  types: TypeInfo[],
  typeId: string,
  tTypes: (key: string) => string,
): string {
  const type = types.find((candidate) => candidate.id === typeId);
  return type
    ? `${type.emoji ?? ""} ${contactTypeLabel(type, tTypes)}`.trim()
    : typeId;
}

const stateCard: Record<WindowState, string> = {
  upcoming: "border-line bg-panel",
  open: "border-accent/40 bg-accent-soft",
  stillOpen: "border-warn/25 bg-warn-soft/60",
};

const stateChip: Record<WindowState, string> = {
  upcoming: "bg-faint text-muted",
  open: "bg-panel/70 text-accent-ink",
  stillOpen: "bg-panel/70 text-warn",
};

export function TaskCard({
  task,
  types,
  today,
  friend,
}: Readonly<{
  task: Task;
  types: TypeInfo[];
  today: string;
  /** Set where the card stands alone (the dashboard) and must say who. */
  friend?: { id: string; name: string; color: string | null };
}>) {
  const t = useTranslations("tasks");
  const tTypes = useTranslations("contactTypes");
  const format = useFormatter();
  const [mode, setMode] = useState<"idle" | "complete" | "snooze" | "reschedule">(
    "idle",
  );
  const state = windowState(task.dueDate, task.windowDays, today);
  const suggestion = `${task.kind === "birthday" ? "🎂 " : ""}${t(
    task.kind === "birthday" ? "birthdaySuggestion" : "suggestion",
    { type: typeText(types, task.suggestedTypeId, tTypes) },
  )}`;
  const stateLabel = t(`state.${state}`, {
    date: format.dateTime(new Date(`${task.dueDate}T12:00:00`), {
      day: "numeric",
      month: "short",
    }),
  });

  return (
    <div
      className={`flex flex-col gap-3 rounded-2xl border p-4 shadow-card ${stateCard[state]}`}
    >
      {friend ? (
        <div className="flex items-center gap-3">
          <Avatar name={friend.name} color={friend.color} />
          <div className="flex min-w-0 flex-1 flex-col">
            <Link
              href={`/friends/${friend.id}`}
              className="truncate font-bold underline-offset-2 hover:underline"
            >
              {friend.name}
            </Link>
            <span className="truncate text-sm">{suggestion}</span>
          </div>
        </div>
      ) : (
        <span className="font-semibold">{suggestion}</span>
      )}
      <span
        className={`self-start rounded-full px-2.5 py-0.5 text-xs font-semibold ${stateChip[state]}`}
      >
        {stateLabel}
      </span>

      {mode === "idle" ? (
        <div className="mt-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setMode("complete")}
            className={buttonClass}
          >
            <Icon name="check" size={16} />
            {t("done")}
          </button>
          <button
            type="button"
            onClick={() => setMode("snooze")}
            className={buttonGhostClass}
          >
            <Icon name="clock" size={16} />
            {t("snooze")}
          </button>
          <button
            type="button"
            onClick={() => setMode("reschedule")}
            className={buttonGhostClass}
          >
            <Icon name="move" size={16} />
            {t("reschedule")}
          </button>
          <button
            type="button"
            onClick={() => void skipTask(task.id)}
            className={buttonQuietClass}
          >
            {t("skip")}
          </button>
        </div>
      ) : null}

      {mode === "complete" ? (
        <CompleteTaskForm
          task={task}
          types={types}
          today={today}
          onCancel={() => setMode("idle")}
        />
      ) : null}

      {mode === "snooze" ? (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={buttonGhostClass}
            onClick={() => {
              void snoozeTask(task.id, 3);
              setMode("idle");
            }}
          >
            {t("snoozeDays", { n: 3 })}
          </button>
          <button
            type="button"
            className={buttonGhostClass}
            onClick={() => {
              void snoozeTask(task.id, 7);
              setMode("idle");
            }}
          >
            {t("snoozeDays", { n: 7 })}
          </button>
          <button
            type="button"
            onClick={() => setMode("idle")}
            className={buttonQuietClass}
          >
            {t("cancel")}
          </button>
        </div>
      ) : null}

      {mode === "reschedule" ? (
        <form
          className="flex flex-wrap items-end gap-2"
          action={(formData: FormData) => {
            const date = String(formData.get("dueDate") ?? "");
            if (date) void rescheduleTask(task.id, date);
            setMode("idle");
          }}
        >
          <label className={labelClass}>
            {t("newDate")}
            <input
              name="dueDate"
              type="date"
              required
              min={today}
              defaultValue={task.dueDate}
              className={inputClass}
            />
          </label>
          <button type="submit" className={buttonClass}>
            {t("reschedule")}
          </button>
          <button
            type="button"
            onClick={() => setMode("idle")}
            className={buttonQuietClass}
          >
            {t("cancel")}
          </button>
        </form>
      ) : null}
    </div>
  );
}

function CompleteTaskForm({
  task,
  types,
  today,
  onCancel,
}: Readonly<{
  task: Task;
  types: TypeInfo[];
  today: string;
  onCancel: () => void;
}>) {
  const t = useTranslations("tasks");
  const tTypes = useTranslations("contactTypes");
  const bound = completeTask.bind(null, task.id);
  const [state, action, pending] = useActionState<TaskFormState, FormData>(
    bound,
    {},
  );

  return (
    <form action={action} className="flex flex-col gap-3">
      {state.error ? (
        <p className={errorClass}>{t(`errors.${state.error}`)}</p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={labelClass}>
          {t("whatHappened")}
          <select
            name="contactTypeId"
            defaultValue={task.suggestedTypeId}
            className={inputClass}
          >
            {types.map((type) => (
              <option key={type.id} value={type.id}>
                {`${type.emoji ?? ""} ${contactTypeLabel(type, tTypes)}`.trim()}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          {t("when")}
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
        {t("noteLabel")}
        <textarea name="note" rows={2} maxLength={10000} className={inputClass} />
      </label>
      <div className="flex items-center gap-2">
        <button type="submit" disabled={pending} className={buttonClass}>
          <Icon name="check" size={16} />
          {t("logAndDone")}
        </button>
        <button type="button" onClick={onCancel} className={buttonQuietClass}>
          {t("cancel")}
        </button>
      </div>
    </form>
  );
}

export function ManualTaskForm({
  friendId,
  types,
  today,
}: Readonly<{ friendId: string; types: TypeInfo[]; today: string }>) {
  const t = useTranslations("tasks");
  const tTypes = useTranslations("contactTypes");
  const [state, action, pending] = useActionState<TaskFormState, FormData>(
    createManualTask,
    {},
  );

  return (
    <form action={action} className={`${cardClass} flex flex-wrap items-end gap-3`}>
      <h3 className={`${h2Class} w-full`}>{t("planTitle")}</h3>
      {state.error ? (
        <p className={`${errorClass} w-full`}>{t(`errors.${state.error}`)}</p>
      ) : null}
      <input type="hidden" name="friendId" value={friendId} />
      <label className={labelClass}>
        {t("newDate")}
        <input
          name="dueDate"
          type="date"
          required
          min={today}
          className={inputClass}
        />
      </label>
      <label className={labelClass}>
        {t("whatHappened")}
        <select name="contactTypeId" defaultValue="" className={inputClass}>
          <option value="">{t("surpriseMe")}</option>
          {types.map((type) => (
            <option key={type.id} value={type.id}>
              {`${type.emoji ?? ""} ${contactTypeLabel(type, tTypes)}`.trim()}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" disabled={pending} className={buttonClass}>
        {t("plan")}
      </button>
    </form>
  );
}
