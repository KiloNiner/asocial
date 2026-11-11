import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { ArchiveButton } from "@/components/friends/ArchiveButton";
import {
  JournalTimeline,
  LogInteractionForm,
} from "@/components/journal/Journal";
import { ManualTaskForm, TaskCard } from "@/components/tasks/TaskCard";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import {
  buttonGhostClass,
  cardClass,
  chipClass,
  eyebrowClass,
  h1Class,
  h2Class,
} from "@/components/ui/classes";
import { getSettings, requireUserOrRedirect } from "@/lib/auth/current-user";
import * as q from "@/lib/db/queries";
import { effectiveInterval } from "@/lib/scheduler/interval";
import { today } from "@/lib/scheduler/clock";
import { pendingTask } from "@/lib/scheduler/schedule";
import { Link } from "@/i18n/navigation";

export default async function FriendDetailPage({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const user = await requireUserOrRedirect();
  const { id } = await params;
  const friend = q.getFriend(user.id, id);
  if (!friend) notFound();

  const t = await getTranslations();
  const format = await getFormatter();
  const settings = await getSettings(user.id);
  const circles = q.getFriendCircles(user.id, id);
  const types = q.listContactTypes(user.id);
  const entries = q.listInteractions(user.id, id);

  const interval = effectiveInterval(friend, circles, settings);
  const intervalText =
    interval.source.kind === "override"
      ? t("friends.intervalSource.override", { n: interval.days })
      : interval.source.kind === "circle"
        ? t("friends.intervalSource.circle", {
            n: interval.days,
            circle: interval.source.circle.name,
          })
        : t("friends.intervalSource.default", { n: interval.days });

  const currentDate = today(settings.timezone);
  const typeInfo = types.map((type) => ({
    id: type.id,
    name: type.name,
    emoji: type.emoji,
  }));
  const contactTypeInfo = typeInfo.filter((type) => type.id !== "congratulate");
  const contactTask = pendingTask(user.id, friend.id, "contact");
  const birthdayTask = pendingTask(user.id, friend.id, "birthday");
  const governingColor =
    interval.source.kind === "circle"
      ? interval.source.circle.color
      : circles[0]?.color;

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/friends"
        className="flex items-center gap-1.5 self-start text-sm font-medium text-muted hover:text-ink"
      >
        <Icon name="arrowLeft" size={16} />
        {t("nav.friends")}
      </Link>

      <div className="flex flex-wrap items-center gap-4">
        <Avatar name={friend.name} color={governingColor} size="lg" />
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className={h1Class}>
            {friend.name}
            {friend.archived ? (
              <span className="ml-3 rounded-full bg-faint px-2.5 py-1 align-middle text-xs font-medium tracking-normal text-muted">
                {t("friends.archived")}
              </span>
            ) : null}
          </h1>
          <p className="text-sm text-muted">{intervalText}</p>
        </div>
        <div className="ml-auto flex gap-2">
          <Link href={`/friends/${friend.id}/edit`} className={buttonGhostClass}>
            <Icon name="pencil" size={15} />
            {t("common.edit")}
          </Link>
          <ArchiveButton friendId={friend.id} archived={friend.archived} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start">
        <div className="flex min-w-0 flex-col gap-8">
          <section className="flex flex-col gap-3">
            <h2 className={h2Class}>{t("tasks.nextUp")}</h2>
            {birthdayTask ? (
              <TaskCard
                key={birthdayTask.id}
                task={birthdayTask}
                types={typeInfo}
                today={currentDate}
              />
            ) : null}
            {contactTask ? (
              <TaskCard
                key={contactTask.id}
                task={contactTask}
                types={contactTypeInfo}
                today={currentDate}
              />
            ) : !friend.archived ? (
              <ManualTaskForm
                friendId={friend.id}
                types={contactTypeInfo}
                today={currentDate}
              />
            ) : null}
          </section>

          <LogInteractionForm
            friendId={friend.id}
            types={contactTypeInfo}
            today={currentDate}
          />

          <section className="flex flex-col gap-4">
            <h2 className={h2Class}>{t("journal.title")}</h2>
            <JournalTimeline
              friendId={friend.id}
              entries={entries}
              types={typeInfo}
            />
          </section>
        </div>

        {/* Who they are: beside the work on wide screens, above it on narrow. */}
        <aside className={`${cardClass} order-first lg:order-none`}>
          <dl className="flex flex-col gap-4 text-sm">
            <div className="flex flex-col gap-1.5">
              <dt className={eyebrowClass}>{t("friends.circlesLabel")}</dt>
              <dd className="flex flex-wrap gap-1.5">
                {circles.length === 0 ? (
                  <span className="text-muted">{t("common.none")}</span>
                ) : (
                  circles.map((circle) => (
                    <span key={circle.id} className={chipClass}>
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: circle.color }}
                      />
                      {circle.name}
                    </span>
                  ))
                )}
              </dd>
            </div>
            {friend.birthMonth && friend.birthDay ? (
              <div className="flex flex-col gap-1">
                <dt className={eyebrowClass}>{t("friends.birthday")}</dt>
                <dd>
                  🎂{" "}
                  {format.dateTime(
                    new Date(Date.UTC(2000, friend.birthMonth - 1, friend.birthDay, 12)),
                    { day: "numeric", month: "long", timeZone: "UTC" },
                  )}
                  {friend.birthYear ? ` ${friend.birthYear}` : ""}
                </dd>
              </div>
            ) : null}
            {friend.notes ? (
              <div className="flex flex-col gap-1">
                <dt className={eyebrowClass}>{t("friends.notes")}</dt>
                <dd className="whitespace-pre-wrap text-muted">{friend.notes}</dd>
              </div>
            ) : null}
          </dl>
        </aside>
      </div>
    </div>
  );
}
