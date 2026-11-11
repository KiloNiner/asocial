import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { ActionWindowBoard } from "@/components/board/ActionWindowBoard";
import { DigestPrompt } from "@/components/dashboard/DigestPrompt";
import { StartFreshPrompt } from "@/components/dashboard/StartFreshPrompt";
import { TaskCard } from "@/components/tasks/TaskCard";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import {
  buttonClass,
  buttonGhostClass,
  cardClass,
  eyebrowClass,
  h1Class,
  h2Class,
} from "@/components/ui/classes";
import type { Task } from "@/db/schema";
import { Link } from "@/i18n/navigation";
import { getSettings, requireUserOrRedirect } from "@/lib/auth/current-user";
import { contactTypeLabel } from "@/lib/contact-type-label";
import * as q from "@/lib/db/queries";
import { smtpConfigured } from "@/lib/notifications/channel";
import { dismissedPrompts } from "@/lib/prompts";
import { isBehind } from "@/lib/scheduler/backlog";
import { today } from "@/lib/scheduler/clock";
import { addDays } from "@/lib/scheduler/dates";
import { contactBacklog } from "@/lib/scheduler/reset";
import { windowState } from "@/lib/scheduler/window-state";

/** How far ahead "opening soon" looks. */
const SOON_DAYS = 7;

type Entry = {
  task: Task;
  friend: { id: string; name: string; color: string | null };
};

export default async function DashboardPage() {
  const user = await requireUserOrRedirect();
  const settings = await getSettings(user.id);
  const t = await getTranslations();
  const tTypes = await getTranslations("contactTypes");
  const format = await getFormatter();
  const locale = await getLocale();
  const currentDate = today(settings.timezone);

  const rows = q.boardRows(user.id);
  const types = q.listContactTypes(user.id);
  const typeInfo = types.map((type) => ({
    id: type.id,
    name: type.name,
    emoji: type.emoji,
  }));
  const typeById = new Map(types.map((type) => [type.id, type]));
  const dismissed = await dismissedPrompts();
  const backlog = contactBacklog(user.id, settings.timezone);

  // The board is the map; these two lists are the answer to "what now?" —
  // the same pending tasks, split by whether their window has opened.
  const openNow: Entry[] = [];
  const soon: Entry[] = [];
  const soonLimit = addDays(currentDate, SOON_DAYS);
  for (const row of rows) {
    const friend = {
      id: row.friend.id,
      name: row.friend.name,
      color: row.color,
    };
    // Birthday first: on the day, it is the one that cannot wait.
    for (const task of [row.birthdayTask, row.contactTask]) {
      if (!task) continue;
      const state = windowState(task.dueDate, task.windowDays, currentDate);
      if (state !== "upcoming") openNow.push({ task, friend });
      else if (task.dueDate <= soonLimit) soon.push({ task, friend });
    }
  }
  soon.sort((a, b) => a.task.dueDate.localeCompare(b.task.dueDate));

  // Only once there is something to be notified *about* — an account with an
  // empty board would be offered a digest of nothing.
  const offerDigest =
    rows.length > 0 &&
    !dismissed.has("digestOff") &&
    !q.hasEnabledNotificationChannel(user.id);
  // At most one prompt at a time. Someone whose board has stalled has a more
  // pressing problem than which channel their digest arrives on.
  const offerStartFresh = !dismissed.has("startFresh") && isBehind(backlog);

  const openFriends = new Set(openNow.map((entry) => entry.friend.id)).size;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <p className={`${eyebrowClass} first-letter:uppercase`}>
          {format.dateTime(new Date(`${currentDate}T12:00:00`), {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </p>
        <h1 className={h1Class}>
          {t("dashboard.greeting", {
            name: user.displayName.trim().split(/\s+/)[0],
          })}
        </h1>
        {rows.length > 0 ? (
          <p className="text-muted">
            {openFriends > 0
              ? t("digest.title", { n: openFriends })
              : t("dashboard.allClear")}
          </p>
        ) : null}
      </header>

      {offerStartFresh ? (
        <StartFreshPrompt
          lingering={backlog.lingering}
          oldestDays={backlog.oldestDays}
        />
      ) : offerDigest ? (
        <DigestPrompt canEmail={smtpConfigured()} />
      ) : null}

      {rows.length === 0 ? (
        <div className={`${cardClass} flex flex-col items-start gap-4 sm:p-8`}>
          <p className="text-muted">{t("dashboard.empty")}</p>
          <div className="flex flex-wrap gap-2">
            <Link href="/friends/new" className={buttonClass}>
              <Icon name="plus" size={16} />
              {t("friends.add")}
            </Link>
            <Link href="/circles" className={buttonGhostClass}>
              {t("nav.circles")}
            </Link>
          </div>
        </div>
      ) : (
        <>
          {openNow.length > 0 ? (
            <section className="flex flex-col gap-3">
              <h2 className={h2Class}>{t("dashboard.openNow")}</h2>
              <div className="grid gap-3 lg:grid-cols-2">
                {openNow.map(({ task, friend }) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    friend={friend}
                    types={
                      task.kind === "birthday"
                        ? typeInfo
                        : typeInfo.filter((type) => type.id !== "congratulate")
                    }
                    today={currentDate}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {soon.length > 0 ? (
            <section className="flex flex-col gap-3">
              <h2 className={h2Class}>{t("dashboard.openingSoon")}</h2>
              <ul className="flex flex-wrap gap-2">
                {soon.map(({ task, friend }) => {
                  const type = typeById.get(task.suggestedTypeId);
                  return (
                    <li key={task.id} className="w-full sm:w-auto">
                      <Link
                        href={`/friends/${friend.id}`}
                        title={type ? contactTypeLabel(type, tTypes) : undefined}
                        className="flex items-center gap-2 rounded-full border border-line bg-panel py-1 pl-1 pr-3.5 text-sm shadow-card transition-colors hover:bg-faint"
                      >
                        <Avatar name={friend.name} color={friend.color} size="sm" />
                        <span className="font-semibold">{friend.name}</span>
                        <span>
                          {task.kind === "birthday" ? "🎂" : (type?.emoji ?? "")}
                        </span>
                        <span className="ml-auto pl-2 text-muted">
                          {format.dateTime(new Date(`${task.dueDate}T12:00:00`), {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                          })}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          <section className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <h2 className={h2Class}>{t("dashboard.boardTitle")}</h2>
              <p className="max-w-[80ch] text-sm text-muted">
                {t("dashboard.intro")}
              </p>
            </div>
            <ActionWindowBoard
              rows={rows}
              types={types}
              today={currentDate}
              locale={locale}
            />
          </section>
        </>
      )}
    </div>
  );
}
