import { getLocale, getTranslations } from "next-intl/server";
import { getSettings, requireUserOrRedirect } from "@/lib/auth/current-user";
import * as q from "@/lib/db/queries";
import { today } from "@/lib/scheduler/clock";
import { ageOn } from "@/lib/scheduler/birthday";
import { Link } from "@/i18n/navigation";
import { Icon } from "@/components/ui/Icon";
import { h1Class, listClass } from "@/components/ui/classes";
import { CalendarFeedCard } from "@/components/calendar/CalendarFeedCard";
import { getCalendarFeedToken } from "@/lib/auth/calendar-feed";
import { appUrl } from "@/lib/app-url";

type Chip = {
  key: string;
  friendId: string;
  label: string;
  emoji: string;
  color: string | null;
  kind: "task" | "birthday" | "overdue";
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export default async function CalendarPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ month?: string }> }>) {
  const user = await requireUserOrRedirect();
  const settings = await getSettings(user.id);
  const t = await getTranslations();
  const locale = await getLocale();
  const currentDate = today(settings.timezone);

  const { month: monthParam } = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(monthParam ?? "")
    ? monthParam!
    : currentDate.slice(0, 7);
  const [year, monthNum] = [Number(month.slice(0, 4)), Number(month.slice(5, 7))];

  const prev = monthNum === 1 ? `${year - 1}-12` : `${year}-${pad(monthNum - 1)}`;
  const next = monthNum === 12 ? `${year + 1}-01` : `${year}-${pad(monthNum + 1)}`;
  const daysInMonth = new Date(year, monthNum, 0).getDate();
  // Monday-first offset: JS getDay() 0=Sun..6=Sat -> Monday=0..Sunday=6
  const firstDow = (new Date(year, monthNum - 1, 1).getDay() + 6) % 7;

  const monthTitle = new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
  }).format(new Date(year, monthNum - 1, 1));
  const weekdayFmt = new Intl.DateTimeFormat(locale, { weekday: "short" });
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    // 2024-01-01 was a Monday
    weekdayFmt.format(new Date(2024, 0, 1 + i)),
  );

  // Build chips per date
  const chipsByDate = new Map<string, Chip[]>();
  const push = (date: string, chip: Chip) => {
    const list = chipsByDate.get(date) ?? [];
    list.push(chip);
    chipsByDate.set(date, list);
  };

  const pending = q.listPendingTasksWithNames(user.id);
  for (const { task, friendName, color } of pending) {
    if (task.kind === "birthday") continue; // rendered from friend data below
    if (task.dueDate < currentDate) {
      // Overdue tasks live on today, not bleeding across past days.
      if (currentDate.slice(0, 7) === month) {
        push(currentDate, {
          key: task.id,
          friendId: task.friendId,
          label: friendName,
          emoji: "⏳",
          color,
          kind: "overdue",
        });
      }
    } else if (task.dueDate.slice(0, 7) === month) {
      push(task.dueDate, {
        key: task.id,
        friendId: task.friendId,
        label: friendName,
        emoji: "•",
        color,
        kind: "task",
      });
    }
  }

  for (const birthday of q.listBirthdays(user.id)) {
    if (birthday.birthMonth !== monthNum) continue;
    // Feb 29 shows on Feb 28 in non-leap years
    const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    const day =
      birthday.birthMonth === 2 && birthday.birthDay === 29 && !isLeap
        ? 28
        : birthday.birthDay;
    if (day > daysInMonth) continue;
    const date = `${month}-${pad(day)}`;
    const age = birthday.birthYear ? ageOn(birthday.birthYear, date) : null;
    push(date, {
      key: `bd-${birthday.friendId}`,
      friendId: birthday.friendId,
      label:
        age !== null
          ? `${birthday.name} (${t("friends.age", { age })})`
          : birthday.name,
      emoji: "🎂",
      color: null,
      kind: "birthday",
    });
  }

  const cells: { date: string | null; day: number | null }[] = [
    ...Array.from({ length: firstDow }, () => ({ date: null, day: null })),
    ...Array.from({ length: daysInMonth }, (_, i) => ({
      date: `${month}-${pad(i + 1)}`,
      day: i + 1,
    })),
  ];
  while (cells.length % 7 !== 0) cells.push({ date: null, day: null });

  const feedToken = getCalendarFeedToken(user.id);
  const feedUrl = feedToken
    ? `${appUrl()}/api/calendar/${feedToken}/asocial.ics`
    : null;

  const agenda = cells.filter(
    (cell): cell is { date: string; day: number } =>
      cell.date !== null && chipsByDate.has(cell.date),
  );
  const navButton =
    "flex h-9 items-center justify-center px-2.5 text-ink transition-colors hover:bg-faint";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className={`${h1Class} capitalize`}>{monthTitle}</h1>
        <div className="ml-auto flex divide-x divide-line overflow-hidden rounded-lg border border-line bg-panel shadow-card">
          <Link
            href={`/calendar?month=${prev}`}
            aria-label={t("calendar.previous")}
            title={t("calendar.previous")}
            className={navButton}
          >
            <Icon name="chevronLeft" />
          </Link>
          <Link
            href="/calendar"
            className={`${navButton} px-3.5 text-sm font-semibold`}
          >
            {t("calendar.today")}
          </Link>
          <Link
            href={`/calendar?month=${next}`}
            aria-label={t("calendar.next")}
            title={t("calendar.next")}
            className={navButton}
          >
            <Icon name="chevronRight" />
          </Link>
        </div>
      </div>

      {/* Phones get the month as an agenda: a 7-column grid at that width
          leaves no room for a name. */}
      <div className="md:hidden">
        {agenda.length === 0 ? (
          <p className="text-sm text-muted">{t("calendar.emptyMonth")}</p>
        ) : (
          <ol className={listClass}>
            {agenda.map((cell) => {
              const isToday = cell.date === currentDate;
              return (
                <li
                  key={cell.date}
                  className={`flex items-start gap-3 px-3 py-2.5 ${
                    isToday ? "bg-accent-soft/60" : ""
                  }`}
                >
                  <span
                    className={`flex w-11 shrink-0 flex-col items-center rounded-lg py-1 leading-tight ${
                      isToday ? "bg-accent text-on-accent" : "bg-faint"
                    }`}
                  >
                    <span className="text-[10px] font-bold uppercase opacity-80">
                      {weekdays[(firstDow + cell.day - 1) % 7]}
                    </span>
                    <span className="text-base font-extrabold">{cell.day}</span>
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-1 pt-0.5">
                    {chipsByDate.get(cell.date)!.map((chip) => (
                      <ChipLink key={chip.key} chip={chip} roomy />
                    ))}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <div className="hidden overflow-hidden rounded-2xl border border-line bg-line shadow-card md:block">
        <div className="grid grid-cols-7 bg-panel text-center text-xs font-bold uppercase tracking-wider text-subtle">
          {weekdays.map((weekday) => (
            <span key={weekday} className="py-2.5">
              {weekday}
            </span>
          ))}
        </div>
        {/* gap-px over a line-colored backing draws the hairlines, so no cell
            has to know whether it sits on an edge. */}
        <div className="grid grid-cols-7 gap-px border-t border-line">
          {cells.map((cell, i) => {
            const isToday = cell.date === currentDate;
            return (
              <div
                key={cell.date ?? `empty-${i}`}
                className={`min-h-28 min-w-0 p-1.5 ${
                  // Days outside the month sink to the page surface, which is
                  // the recessed tone in every theme (faint is not: on dark
                  // themes it is lighter than a panel). Weekends sit halfway.
                  !cell.day
                    ? "bg-surface"
                    : isToday
                      ? "bg-accent-soft"
                      : i % 7 >= 5
                        ? "bg-[color-mix(in_srgb,var(--t-surface)_50%,var(--t-panel))]"
                        : "bg-panel"
                }`}
              >
                {cell.day ? (
                  <>
                    <span
                      className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs ${
                        isToday
                          ? "bg-accent font-bold text-on-accent"
                          : "font-semibold text-muted"
                      }`}
                    >
                      {cell.day}
                    </span>
                    <div className="mt-1 flex flex-col gap-0.5">
                      {(chipsByDate.get(cell.date!) ?? []).map((chip) => (
                        <ChipLink key={chip.key} chip={chip} />
                      ))}
                    </div>
                  </>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <CalendarFeedCard url={feedUrl} />
    </div>
  );
}

const chipKind: Record<Chip["kind"], string> = {
  overdue: "bg-warn-soft text-warn",
  birthday: "bg-birthday-soft text-birthday",
  task: "bg-faint text-ink",
};

function ChipLink({
  chip,
  roomy,
}: Readonly<{ chip: Chip; roomy?: boolean }>) {
  return (
    <Link
      href={`/friends/${chip.friendId}`}
      className={`truncate rounded-md font-medium transition hover:brightness-95 ${
        roomy ? "px-2 py-1 text-sm" : "px-1.5 py-0.5 text-xs"
      } ${chipKind[chip.kind]}`}
    >
      {chip.kind !== "birthday" ? (
        <span
          className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle"
          style={{ backgroundColor: chip.color ?? "var(--t-dot)" }}
        />
      ) : null}
      {chip.emoji !== "•" ? `${chip.emoji} ` : ""}
      {chip.label}
    </Link>
  );
}
