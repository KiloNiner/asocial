import { getTranslations } from "next-intl/server";
import { BoardRow, type BandSpec } from "./BoardRow";
import type { BoardRow as BoardRowData } from "@/lib/db/queries";
import type { ContactType } from "@/db/schema";
import { addDays, daysBetween } from "@/lib/scheduler/dates";

const DAYS_BEFORE = 3;
const DAYS_AFTER = 27;
const COLUMNS = DAYS_BEFORE + 1 + DAYS_AFTER; // 31 day columns

function windowState(
  dueDate: string,
  windowDays: number,
  today: string,
): BandSpec["state"] {
  if (today < dueDate) return "upcoming";
  return today <= addDays(dueDate, windowDays - 1) ? "open" : "stillOpen";
}

/** Grid column for a date: column 2 = rangeStart (col 1 is the name). */
function colFor(date: string, rangeStart: string): number | null {
  const offset = daysBetween(rangeStart, date);
  if (offset < 0 || offset >= COLUMNS) return null;
  return offset + 2;
}

export async function ActionWindowBoard({
  rows,
  types,
  today,
  locale,
}: Readonly<{
  rows: BoardRowData[];
  types: ContactType[];
  today: string;
  locale: string;
}>) {
  const t = await getTranslations("dashboard");
  const rangeStart = addDays(today, -DAYS_BEFORE);
  const dayFmt = new Intl.DateTimeFormat(locale, { day: "numeric" });
  const weekdayFmt = new Intl.DateTimeFormat(locale, { weekday: "narrow" });
  const monthFmt = new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
  });

  const days = Array.from({ length: COLUMNS }, (_, i) => {
    const date = addDays(rangeStart, i);
    const jsDate = new Date(`${date}T12:00:00`);
    const dow = jsDate.getDay(); // 0 = Sunday
    return {
      date,
      col: i + 2,
      dayLabel: dayFmt.format(jsDate),
      weekdayLabel: weekdayFmt.format(jsDate),
      isToday: date === today,
      isWeekend: dow === 0 || dow === 6,
      isMonthStart: date.endsWith("-01"),
      monthLabel: monthFmt.format(jsDate),
    };
  });

  const typeInfo = types.map((type) => ({
    id: type.id,
    name: type.name,
    emoji: type.emoji,
  }));
  const typeById = new Map(types.map((type) => [type.id, type]));

  if (rows.length === 0) {
    return <p className="text-sm text-muted">{t("empty")}</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-panel p-3">
      <div className="min-w-[720px]">
        {/* header */}
        <div
          className="grid border-b border-line pb-1 text-center text-[10px] text-subtle"
          style={{
            gridTemplateColumns: `11rem repeat(${COLUMNS}, minmax(24px, 1fr))`,
          }}
        >
          <span style={{ gridColumn: "1" }} />
          {days.map((day) => (
            <span key={day.date} style={{ gridColumn: day.col }}>
              {day.weekdayLabel}
              <br />
              <span
                className={
                  day.isToday
                    ? "rounded-full bg-accent px-1 font-semibold text-on-accent"
                    : "text-muted"
                }
              >
                {day.dayLabel}
              </span>
            </span>
          ))}
        </div>

        {/* weekend + today shading behind rows */}
        <div className="relative">
          <div
            className="pointer-events-none absolute inset-0 grid"
            style={{
              gridTemplateColumns: `11rem repeat(${COLUMNS}, minmax(24px, 1fr))`,
            }}
          >
            {days.map((day) =>
              day.isWeekend || day.isToday ? (
                <span
                  key={day.date}
                  className={
                    day.isToday
                      ? "border-x border-accent/70 bg-accent-soft/40"
                      : "bg-surface"
                  }
                  style={{ gridColumn: day.col, gridRow: "1 / -1" }}
                />
              ) : null,
            )}
          </div>

          <div className="relative">
            {rows.map((row) => {
              let band: BandSpec | null = null;
              if (row.contactTask) {
                const task = row.contactTask;
                // A pending task from the past keeps its window anchored on
                // its due date but is clamped into the visible range.
                const startCol = colFor(task.dueDate, rangeStart);
                const endDate = addDays(task.dueDate, task.windowDays - 1);
                const visibleStart = startCol ?? 2;
                const endColRaw = colFor(
                  endDate < rangeStart ? today : endDate,
                  rangeStart,
                );
                const endCol = Math.max(
                  endColRaw ?? COLUMNS + 1,
                  visibleStart,
                );
                band = {
                  task,
                  startCol: visibleStart,
                  endCol: Math.min(endCol, COLUMNS + 1),
                  state: windowState(task.dueDate, task.windowDays, today),
                  clippedStart: startCol === null,
                };
              }
              const birthdayCol = row.birthdayTask
                ? colFor(row.birthdayTask.dueDate, rangeStart)
                : null;
              const suggested = row.contactTask
                ? typeById.get(row.contactTask.suggestedTypeId)
                : null;

              return (
                <BoardRow
                  key={row.friend.id}
                  friendId={row.friend.id}
                  friendName={row.friend.name}
                  color={row.color ?? "#a8a29e"}
                  emoji={suggested?.emoji ?? (row.birthdayTask ? "🎂" : "")}
                  band={band}
                  birthdayCol={birthdayCol}
                  birthdayTask={row.birthdayTask}
                  types={typeInfo}
                  today={today}
                  columns={COLUMNS}
                />
              );
            })}
          </div>
        </div>

        {/* legend */}
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted">
          <span className="flex items-center gap-1">
            <span className="h-3 w-6 rounded-full bg-dot opacity-45" />
            {t("legendUpcoming")}
          </span>
          <span className="flex items-center gap-1">
            <span className="h-3 w-6 rounded-full bg-dot" />
            {t("legendOpen")}
          </span>
          <span className="flex items-center gap-1">
            <span className="h-3 w-6 rounded-full bg-dot opacity-80 saturate-50" />
            {t("legendStillOpen")}
          </span>
          <span className="flex items-center gap-1">🎂 {t("legendBirthday")}</span>
        </div>
      </div>
    </div>
  );
}
