import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { setFriendPref } from "@/actions/friends";
import { ArchiveButton } from "@/components/friends/ArchiveButton";
import {
  JournalTimeline,
  LogInteractionForm,
} from "@/components/journal/Journal";
import { PrefEditor, type PrefRow } from "@/components/prefs/PrefEditor";
import { buttonGhostClass, cardClass } from "@/components/ui/classes";
import { getSettings, requireUser } from "@/lib/auth/current-user";
import * as q from "@/lib/db/queries";
import { effectiveInterval, governingCircle } from "@/lib/scheduler/interval";
import { today } from "@/lib/scheduler/clock";
import { Link } from "@/i18n/navigation";

export default async function FriendDetailPage({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const user = await requireUser();
  const { id } = await params;
  const friend = q.getFriend(user.id, id);
  if (!friend) notFound();

  const t = await getTranslations();
  const settings = await getSettings(user.id);
  const circles = q.getFriendCircles(user.id, id);
  const types = q.listContactTypes(user.id);
  const journalTypes = types.filter((type) => type.id !== "congratulate");
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

  // Friend-level prefs inherit from the governing circle, then user level.
  const circlePrefs = (() => {
    const governing = governingCircle(friend, circles);
    return governing ? q.getCirclePrefs(user.id, governing.id) : new Map();
  })();
  const userPrefs = q.getUserPrefs(user.id);
  const friendPrefs = q.getFriendPrefs(user.id, id);
  const prefRows: PrefRow[] = journalTypes.map((type) => ({
    type: {
      id: type.id,
      name: type.name,
      emoji: type.emoji,
      defaultWeight: type.defaultWeight,
    },
    weight: friendPrefs.get(type.id) ?? null,
    inherited:
      circlePrefs.get(type.id) ??
      userPrefs.get(type.id) ??
      type.defaultWeight,
  }));

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">
            {friend.name}
            {friend.archived ? (
              <span className="ml-2 rounded bg-stone-100 px-2 py-0.5 align-middle text-xs text-stone-500">
                {t("friends.archived")}
              </span>
            ) : null}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-stone-500">
            {circles.map((circle) => (
              <span
                key={circle.id}
                className="flex items-center gap-1 rounded-full border border-stone-200 px-2 py-0.5"
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: circle.color }}
                />
                {circle.name}
              </span>
            ))}
            <span>{intervalText}</span>
            {friend.birthMonth && friend.birthDay ? (
              <span>
                🎂 {friend.birthDay}/{friend.birthMonth}
                {friend.birthYear ? ` (${friend.birthYear})` : ""}
              </span>
            ) : null}
          </div>
        </div>
        <div className="ml-auto flex gap-2">
          <Link href={`/friends/${friend.id}/edit`} className={buttonGhostClass}>
            {t("common.edit")}
          </Link>
          <ArchiveButton friendId={friend.id} archived={friend.archived} />
        </div>
      </div>

      {friend.notes ? (
        <p className={`${cardClass} whitespace-pre-wrap text-sm text-stone-600`}>
          {friend.notes}
        </p>
      ) : null}

      <LogInteractionForm
        friendId={friend.id}
        types={journalTypes.map((type) => ({
          id: type.id,
          name: type.name,
          emoji: type.emoji,
        }))}
        today={today(settings.timezone)}
      />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">{t("journal.title")}</h2>
        <JournalTimeline
          friendId={friend.id}
          entries={entries}
          types={types.map((type) => ({
            id: type.id,
            name: type.name,
            emoji: type.emoji,
          }))}
        />
      </section>

      <section className={`${cardClass} flex flex-col gap-2`}>
        <h2 className="text-lg font-medium">{t("friends.typePrefs")}</h2>
        <PrefEditor
          rows={prefRows}
          action={setFriendPref.bind(null, friend.id)}
          hint={t("friends.typePrefsHint")}
        />
      </section>
    </div>
  );
}
