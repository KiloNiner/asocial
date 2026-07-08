"use client";

import { useTranslations } from "next-intl";
import { useTransition } from "react";
import type { ContactType } from "@/db/schema";
import { contactTypeLabel } from "@/lib/contact-type-label";
import { inputClass } from "@/components/ui/classes";

export type PrefRow = {
  type: Pick<ContactType, "id" | "name" | "emoji" | "defaultWeight">;
  /** Weight set at this level, or null when inherited. */
  weight: number | null;
  /** What applies when this level sets nothing (default chain resolution). */
  inherited: number;
};

/**
 * Weight editor shared by circle-, friend- and user-level preferences.
 * Each row auto-submits on blur (no <form>, so it can be embedded inside
 * another form); "" clears back to inherited.
 */
export function PrefEditor({
  rows,
  action,
  hint,
}: Readonly<{
  rows: PrefRow[];
  action: (formData: FormData) => Promise<void>;
  hint: string;
}>) {
  const t = useTranslations("contactTypes");

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted">{hint}</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {rows.map((row) => (
          <PrefField key={row.type.id} row={row} action={action} label={
            `${row.type.emoji ?? ""} ${contactTypeLabel(row.type, t)}`.trim()
          } />
        ))}
      </div>
    </div>
  );
}

function PrefField({
  row,
  action,
  label,
}: Readonly<{
  row: PrefRow;
  action: (formData: FormData) => Promise<void>;
  label: string;
}>) {
  const [, startTransition] = useTransition();

  return (
    <label className="flex flex-col gap-0.5 text-xs text-muted">
      <span className="truncate" title={label}>
        {label}
      </span>
      <input
        name="weight"
        type="number"
        min={0}
        max={100}
        defaultValue={row.weight ?? ""}
        placeholder={String(row.inherited)}
        className={`${inputClass} w-full`}
        onBlur={(e) => {
          const prev = row.weight === null ? "" : String(row.weight);
          if (e.currentTarget.value !== prev) {
            const formData = new FormData();
            formData.set("contactTypeId", row.type.id);
            formData.set("weight", e.currentTarget.value);
            startTransition(() => {
              action(formData);
            });
          }
        }}
      />
    </label>
  );
}
