import { getLocale, getTranslations } from "next-intl/server";
import { ActionWindowBoard } from "@/components/board/ActionWindowBoard";
import { DigestPrompt } from "@/components/dashboard/DigestPrompt";
import { StartFreshPrompt } from "@/components/dashboard/StartFreshPrompt";
import { getSettings, requireUserOrRedirect } from "@/lib/auth/current-user";
import * as q from "@/lib/db/queries";
import { smtpConfigured } from "@/lib/notifications/channel";
import { dismissedPrompts } from "@/lib/prompts";
import { isBehind } from "@/lib/scheduler/backlog";
import { contactBacklog } from "@/lib/scheduler/reset";
import { today } from "@/lib/scheduler/clock";

export default async function DashboardPage() {
  const user = await requireUserOrRedirect();
  const settings = await getSettings(user.id);
  const t = await getTranslations("dashboard");
  const locale = await getLocale();

  const rows = q.boardRows(user.id);
  const dismissed = await dismissedPrompts();
  const backlog = contactBacklog(user.id, settings.timezone);

  // Only once there is something to be notified *about* — an account with an
  // empty board would be offered a digest of nothing.
  const offerDigest =
    rows.length > 0 &&
    !dismissed.has("digestOff") &&
    !q.hasEnabledNotificationChannel(user.id);
  // At most one prompt at a time. Someone whose board has stalled has a more
  // pressing problem than which channel their digest arrives on.
  const offerStartFresh = !dismissed.has("startFresh") && isBehind(backlog);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted">{t("intro")}</p>
      </div>
      {offerStartFresh ? (
        <StartFreshPrompt
          lingering={backlog.lingering}
          oldestDays={backlog.oldestDays}
        />
      ) : offerDigest ? (
        <DigestPrompt canEmail={smtpConfigured()} />
      ) : null}
      <ActionWindowBoard
        rows={rows}
        types={q.listContactTypes(user.id)}
        today={today(settings.timezone)}
        locale={locale}
      />
    </div>
  );
}
