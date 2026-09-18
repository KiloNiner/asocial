"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { enableEmailDigest, type SettingsFormState } from "@/actions/settings";
import { Nudge } from "@/components/ui/Nudge";
import { buttonClass, buttonGhostClass } from "@/components/ui/classes";
import { Link } from "@/i18n/navigation";

/**
 * Shown to an account nothing can reach. Where SMTP works the prompt does the
 * job itself — the email channel needs no input beyond the account address —
 * and otherwise it can only point at Settings, where Pushover is configurable.
 */
export function DigestPrompt({ canEmail }: Readonly<{ canEmail: boolean }>) {
  const t = useTranslations("notifications.prompt");
  const [state, action, pending] = useActionState<SettingsFormState, FormData>(
    async () => enableEmailDigest(),
    {},
  );

  return (
    <Nudge
      promptKey="digestOff"
      title={t("title")}
      body={canEmail ? t("bodyEmail") : t("bodyOther")}
      dismissLabel={t("dismiss")}
    >
      {canEmail ? (
        <form action={action}>
          <button type="submit" disabled={pending} className={buttonClass}>
            {t("enableEmail")}
          </button>
        </form>
      ) : null}
      <Link
        href="/settings"
        className={canEmail ? "text-sm text-accent hover:underline" : buttonGhostClass}
      >
        {t("openSettings")}
      </Link>
      {state.error ? (
        <span className="text-sm text-warn">{t("failed")}</span>
      ) : null}
    </Nudge>
  );
}
