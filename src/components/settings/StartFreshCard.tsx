"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { startFresh, type StartFreshState } from "@/actions/tasks";
import { Icon } from "@/components/ui/Icon";
import {
  buttonGhostClass,
  cardClass,
  errorClass,
  successClass,
} from "@/components/ui/classes";

/**
 * Permanent home for the reset, next to Backup & restore — the other thing
 * you go looking for when you want to put the app back in order.
 */
export function StartFreshCard({ open }: Readonly<{ open: number }>) {
  const t = useTranslations("startFresh");
  const [state, action, pending] = useActionState<StartFreshState, FormData>(
    async () => startFresh(),
    {},
  );

  return (
    <div className={`${cardClass} flex flex-col gap-4`}>
      <p className="text-sm font-medium">
        {open === 0 ? t("nothingOpen") : t("openNow", { n: open })}
      </p>

      {state.error ? (
        <p className={errorClass}>{t(`errors.${state.error}`)}</p>
      ) : null}
      {state.result ? (
        <p className={successClass}>
          {t("done", {
            cleared: state.result.cleared,
            scheduled: state.result.scheduled,
          })}
        </p>
      ) : null}

      <form
        action={action}
        onSubmit={(e) => {
          if (!confirm(t("confirm"))) e.preventDefault();
        }}
      >
        <button
          type="submit"
          disabled={pending || open === 0}
          className={buttonGhostClass}
        >
          <Icon name="refresh" size={15} />
          {t("action")}
        </button>
      </form>
    </div>
  );
}
