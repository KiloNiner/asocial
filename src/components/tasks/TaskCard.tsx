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
import {
  buttonClass,
  buttonGhostClass,
  cardClass,
  errorClass,
  inputClass,
  labelClass,
} from "@/components/ui/classes";

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

/** State of a pending task relative to today: upcoming / open / stillOpen. */
function windowState(task: Task, today: string) {
  if (today < task.dueDate) return "upcoming" as const;
  const windowEnd = new Date(`${task.dueDate}T12:00:00`);
  windowEnd.setDate(windowEnd.getDate() + task.windowDays - 1);
  const end = windowEnd.toISOString().slice(0, 10);
  return today <= end ? ("open" as const) : ("stillOpen" as const);
}

const stateStyles = {
  upcoming: "border-line bg-panel",
  open: "border-accent bg-accent-soft",
  stillOpen: "border-warn bg-warn-soft",
};

export function TaskCard({
  task,
  types,
  today,
}: Readonly<{ task: Task; types: TypeInfo[]; today: string }>) {
  const t = useTranslations("tasks");
  const tTypes = useTranslations("contactTypes");
  const format = useFormatter();
  const [mode, setMode] = useState<"idle" | "complete" | "snooze" | "reschedule">(
    "idle",
  );
  const state = windowState(task, today);

  return (
    <div className={`${cardClass} flex flex-col gap-3 ${stateStyles[state]}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">
          {task.kind === "birthday" ? "🎂 " : ""}
          {t(task.kind === "birthday" ? "birthdaySuggestion" : "suggestion", {
            type: typeText(types, task.suggestedTypeId, tTypes),
          })}
        </span>
        <span className="ml-auto rounded-full px-2 py-0.5 text-xs text-muted">
          {t(`state.${state}`, {
            date: format.dateTime(new Date(`${task.dueDate}T12:00:00`), {
              day: "numeric",
              month: "short",
            }),
          })}
        </span>
      </div>

      {mode === "idle" ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setMode("complete")}
            className={buttonClass}
          >
            {t("done")}
          </button>
          <button
            type="button"
            onClick={() => setMode("snooze")}
            className={buttonGhostClass}
          >
            {t("snooze")}
          </button>
          <button
            type="button"
            onClick={() => setMode("reschedule")}
            className={buttonGhostClass}
          >
            {t("reschedule")}
          </button>
          <button
            type="button"
            onClick={() => void skipTask(task.id)}
            className={`${buttonGhostClass} text-muted`}
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
            className="text-sm text-muted hover:underline"
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
            className="text-sm text-muted hover:underline"
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
      <div className="flex flex-wrap gap-2">
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
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className={buttonClass}>
          {t("logAndDone")}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-muted hover:underline"
        >
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
    <form action={action} className={`${cardClass} flex flex-wrap items-end gap-2`}>
      <h3 className="w-full text-sm font-medium text-muted">
        {t("planTitle")}
      </h3>
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
