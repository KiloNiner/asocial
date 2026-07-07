import { getFormatter, getTranslations } from "next-intl/server";
import { requireUser, getSettings } from "@/lib/auth/current-user";
import * as q from "@/lib/db/queries";
import { Link } from "@/i18n/navigation";
import { buttonClass, cardClass, inputClass } from "@/components/ui/classes";

export default async function FriendsPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ q?: string; archived?: string }> }>) {
  const user = await requireUser();
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

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{t("friends.title")}</h1>
        <Link href="/friends/new" className={`${buttonClass} ml-auto`}>
          {t("friends.add")}
        </Link>
      </div>

      <form method="get" className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder={t("friends.search")}
          className={`${inputClass} w-56`}
        />
        <label className="flex items-center gap-1.5 text-sm text-muted">
          <input
            type="checkbox"
            name="archived"
            value="1"
            defaultChecked={showArchived}
            className="h-4 w-4 accent-accent"
          />
          {t("friends.showArchived")}
        </label>
      </form>

      {entries.length === 0 ? (
        <p className="text-sm text-muted">
          {all.length === 0 ? t("friends.empty") : t("friends.emptySearch")}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {entries.map(({ friend, circles, lastContact, nextTask }) => (
            <li key={friend.id}>
              <Link
                href={`/friends/${friend.id}`}
                className={`${cardClass} flex flex-wrap items-center gap-3 hover:border-line`}
              >
                <div className="flex min-w-40 flex-col">
                  <span className="font-medium">
                    {friend.name}
                    {friend.archived ? (
                      <span className="ml-2 rounded bg-faint px-1.5 py-0.5 text-xs text-muted">
                        {t("friends.archived")}
                      </span>
                    ) : null}
                  </span>
                  <span className="flex gap-1">
                    {circles.map((circle) => (
                      <span
                        key={circle.id}
                        title={circle.name}
                        className="mt-1 h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: circle.color }}
                      />
                    ))}
                  </span>
                </div>
                <div className="ml-auto flex flex-col items-end text-sm text-muted">
                  <span>
                    {t("friends.lastContact")}:{" "}
                    {lastContact
                      ? format.relativeTime(
                          new Date(`${lastContact}T12:00:00`),
                        )
                      : t("friends.never")}
                  </span>
                  <span>
                    {t("friends.nextContact")}:{" "}
                    {nextTask
                      ? format.dateTime(
                          new Date(`${nextTask.dueDate}T12:00:00`),
                          { dateStyle: "medium" },
                        )
                      : t("common.none")}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
