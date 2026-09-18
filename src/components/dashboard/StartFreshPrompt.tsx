"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { startFresh, type StartFreshState } from "@/actions/tasks";
import { Nudge } from "@/components/ui/Nudge";
import { buttonClass } from "@/components/ui/classes";

/**
 * The reset also lives on the dashboard, because someone on the point of
 * giving up on the app does not go to Settings first — they look at the board,
 * see a wall of amber, and close the tab.
 */
export function StartFreshPrompt({
  lingering,
  oldestDays,
}: Readonly<{ lingering: number; oldestDays: number }>) {
  const t = useTranslations("startFresh.prompt");
  const [state, action, pending] = useActionState<StartFreshState, FormData>(
    async () => startFresh(),
    {},
  );

  return (
    <Nudge
      promptKey="startFresh"
      title={t("title")}
      body={t("body", { n: lingering, days: oldestDays })}
      dismissLabel={t("dismiss")}
    >
      <form
        action={action}
        onSubmit={(e) => {
          if (!confirm(t("confirm"))) e.preventDefault();
        }}
      >
        <button type="submit" disabled={pending} className={buttonClass}>
          {t("action")}
        </button>
      </form>
      {state.error ? (
        <span className="text-sm text-warn">{t("failed")}</span>
      ) : null}
    </Nudge>
  );
}
