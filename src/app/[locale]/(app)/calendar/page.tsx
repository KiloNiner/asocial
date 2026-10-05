import { getLocale, getTranslations } from "next-intl/server";
import { getSettings, requireUserOrRedirect } from "@/lib/auth/current-user";
import * as q from "@/lib/db/queries";
import { today } from "@/lib/scheduler/clock";
import { ageOn } from "@/lib/scheduler/birthday";
import { addDays } from "@/lib/scheduler/dates";
import { Link } from "@/i18n/navigation";
import { buttonGhostClass } from "@/components/ui/classes";
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
  /** Hover/accessible label, e.g. "Anna · 6–12 Oct". */
  title?: string;
};

/** A quiet marker on the remaining days of a task's action window. */
type Mark = {
  key: string;
  color: string | null;
  title: string;
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

  const marksByDate = new Map<string, Mark[]>();
  const rangeFmt = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
  });
  const toDate = (date: string) => {
    const [y, m, d] = date.split("-").map(Number);
    return new Date(y, m - 1, d);
  };

  const pending = q.listPendingTasksWithNames(user.id);
  for (const { task, friendName, color } of pending) {
    if (task.kind === "birthday") continue; // rendered from friend data below
    // Overdue tasks live on today, not bleeding across past days.
    const overdue = task.dueDate < currentDate;
    const chipDate = overdue ? currentDate : task.dueDate;
    const lastDay = addDays(task.dueDate, Math.max(task.windowDays, 1) - 1);
    // The window as still ahead of you: from the chip's day to its last day.
    const title =
      lastDay >= chipDate
        ? `${friendName} · ${rangeFmt.formatRange(toDate(chipDate), toDate(lastDay))}`
        : friendName;
    if (chipDate.slice(0, 7) === month) {
      push(chipDate, {
        key: task.id,
        friendId: task.friendId,
        label: friendName,
        emoji: overdue ? "⏳" : "•",
        color,
        kind: overdue ? "overdue" : "task",
        title,
      });
    }
    // The rest of the window gets a nameless tick rather than a repeat chip,
    // so a week-long window doesn't fill seven cells with the same name.
    for (let date = addDays(chipDate, 1); date <= lastDay; date = addDays(date, 1)) {
      if (date.slice(0, 7) > month) break;
      if (date.slice(0, 7) !== month) continue;
      const marks = marksByDate.get(date) ?? [];
      marks.push({ key: task.id, color, title });
      marksByDate.set(date, marks);
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold capitalize">{monthTitle}</h1>
        <div className="ml-auto flex gap-2">
          <Link href={`/calendar?month=${prev}`} className={buttonGhostClass}>
            ←
          </Link>
          <Link href="/calendar" className={buttonGhostClass}>
            {t("calendar.today")}
          </Link>
          <Link href={`/calendar?month=${next}`} className={buttonGhostClass}>
            →
          </Link>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[640px] rounded-xl border border-line bg-panel">
          <div className="grid grid-cols-7 border-b border-line text-center text-xs font-medium text-muted">
            {weekdays.map((weekday) => (
              <span key={weekday} className="py-2 capitalize">
                {weekday}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((cell, i) => (
              <div
                key={cell.date ?? `empty-${i}`}
                className={`min-h-24 border-b border-r border-line p-1.5 ${
                  cell.date === currentDate ? "bg-accent-soft/60" : ""
                } ${i % 7 >= 5 ? "bg-surface/60" : ""}`}
              >
                {cell.day ? (
                  <>
                    <span
                      className={`text-xs ${
                        cell.date === currentDate
                          ? "rounded-full bg-accent px-1.5 py-0.5 font-semibold text-on-accent"
                          : "text-subtle"
                      }`}
                    >
                      {cell.day}
                    </span>
                    <div className="mt-1 flex flex-col gap-0.5">
                      {(chipsByDate.get(cell.date!) ?? []).map((chip) => (
                        <Link
                          key={chip.key}
                          href={`/friends/${chip.friendId}`}
                          title={chip.title}
                          className={`truncate rounded px-1 py-0.5 text-[11px] leading-tight hover:opacity-80 ${
                            chip.kind === "overdue"
                              ? "bg-warn-soft text-warn"
                              : chip.kind === "birthday"
                                ? "bg-birthday-soft text-birthday"
                                : "bg-faint text-ink"
                          }`}
                        >
                          {chip.color ? (
                            <span
                              className="mr-1 inline-block h-2 w-2 rounded-full align-middle"
                              style={{ backgroundColor: chip.color }}
                            />
                          ) : null}
                          {chip.emoji !== "•" ? `${chip.emoji} ` : ""}
                          {chip.label}
                        </Link>
                      ))}
                    </div>
                    {marksByDate.has(cell.date!) ? (
                      <div className="mt-1 flex flex-wrap gap-0.5 px-1">
                        {marksByDate.get(cell.date!)!.map((mark) => (
                          <span
                            key={mark.key}
                            role="img"
                            title={mark.title}
                            aria-label={mark.title}
                            className={`h-1.5 w-3 rounded-full opacity-60 ${
                              mark.color ? "" : "bg-dot"
                            }`}
                            style={
                              mark.color
                                ? { backgroundColor: mark.color }
                                : undefined
                            }
                          />
                        ))}
                      </div>
                    ) : null}
                  </>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>

      <CalendarFeedCard url={feedUrl} />
    </div>
  );
}
