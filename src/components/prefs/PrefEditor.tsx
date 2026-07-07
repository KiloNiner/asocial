"use client";

import { useTranslations } from "next-intl";
import { useRef } from "react";
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
 * Each row auto-submits its form on change; "" clears back to inherited.
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
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-0.5">
      <label className="flex flex-col gap-0.5 text-xs text-muted">
        <span className="truncate" title={label}>
          {label}
        </span>
        <input type="hidden" name="contactTypeId" value={row.type.id} />
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
              formRef.current?.requestSubmit();
            }
          }}
        />
      </label>
    </form>
  );
}
