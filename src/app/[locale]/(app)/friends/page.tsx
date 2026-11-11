import { getFormatter, getTranslations } from "next-intl/server";
import { requireUserOrRedirect, getSettings } from "@/lib/auth/current-user";
import * as q from "@/lib/db/queries";
import { Link } from "@/i18n/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import {
  buttonClass,
  chipClass,
  h1Class,
  inputClass,
  listClass,
} from "@/components/ui/classes";

export default async function FriendsPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ q?: string; archived?: string }> }>) {
  const user = await requireUserOrRedirect();
  await getSettings(user.id);
  const t = await getTranslations();
  const format = await getFormatter();
  const { q: query = "", archived } = await searchParams;
  const showArchived = archived === "1";

  const all = q.listFriends(user.id, { includeArchived: showArchived });
  const needle = query.trim().toLowerCase();
  const entries = needle
    ? all.filter((e) => e.friend.name.toLowerCase().includes(needle))
    : all;

  // The archived toggle is a link, so it applies at once and keeps the search.
  const toggleParams = new URLSearchParams();
  if (query) toggleParams.set("q", query);
  if (!showArchived) toggleParams.set("archived", "1");
  const toggleHref = toggleParams.size ? `/friends?${toggleParams}` : "/friends";

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className={h1Class}>{t("friends.title")}</h1>
        {all.length > 0 ? (
          <span className={chipClass}>{entries.length}</span>
        ) : null}
        <Link href="/friends/new" className={`${buttonClass} ml-auto`}>
          <Icon name="plus" size={16} />
          {t("friends.add")}
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <form method="get" className="relative min-w-0 flex-1 sm:max-w-xs">
          <Icon
            name="search"
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle"
          />
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder={t("friends.search")}
            aria-label={t("friends.search")}
            className={`${inputClass} w-full pl-9`}
          />
          {showArchived ? <input type="hidden" name="archived" value="1" /> : null}
        </form>
        <Link
          href={toggleHref}
          aria-current={showArchived ? "true" : undefined}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
            showArchived
              ? "border-accent/40 bg-accent-soft text-accent-ink"
              : "border-line bg-panel text-muted hover:bg-faint hover:text-ink"
          }`}
        >
          <Icon name={showArchived ? "check" : "archive"} size={15} />
          {t("friends.showArchived")}
        </Link>
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-muted">
          {all.length === 0 ? t("friends.empty") : t("friends.emptySearch")}
        </p>
      ) : (
        <ul className={listClass}>
          {entries.map(({ friend, circles, lastContact, nextTask }) => (
            <li key={friend.id}>
              <Link
                href={`/friends/${friend.id}`}
                className={`grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 px-4 py-3 transition-colors hover:bg-faint sm:grid-cols-[auto_minmax(0,1fr)_auto] ${
                  friend.archived ? "opacity-70" : ""
                }`}
              >
                <Avatar name={friend.name} color={circles[0]?.color} />
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="flex items-center gap-2 font-bold">
                    <span className="truncate">{friend.name}</span>
                    {friend.archived ? (
                      <span className="rounded-full bg-faint px-2 py-0.5 text-xs font-medium text-muted">
                        {t("friends.archived")}
                      </span>
                    ) : null}
                  </span>
                  {circles.length > 0 ? (
                    <span className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
                      {circles.map((circle) => (
                        <span key={circle.id} className="flex items-center gap-1.5">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: circle.color }}
                          />
                          {circle.name}
                        </span>
                      ))}
                    </span>
                  ) : null}
                </div>
                <dl className="col-start-2 grid grid-cols-[auto_1fr] gap-x-3 text-sm sm:col-start-3 sm:w-60 sm:[&>dd]:text-right">
                  <dt className="text-muted">{t("friends.lastContact")}</dt>
                  <dd className="font-medium">
                    {lastContact
                      ? format.relativeTime(new Date(`${lastContact}T12:00:00`))
                      : t("friends.never")}
                  </dd>
                  <dt className="text-muted">{t("friends.nextContact")}</dt>
                  <dd className="font-medium">
                    {nextTask
                      ? format.dateTime(
                          new Date(`${nextTask.dueDate}T12:00:00`),
                          { dateStyle: "medium" },
                        )
                      : t("common.none")}
                  </dd>
                </dl>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
