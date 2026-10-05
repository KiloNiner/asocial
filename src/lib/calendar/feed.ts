/**
 * Turns pending tasks and birthdays into .ics events. Pure: translation,
 * "today" and the base URL are all passed in.
 */
import type { BirthdayEntry, CalendarFeedTask } from "@/lib/db/queries";
import { contactTypeLabel } from "@/lib/contact-type-label";
import { addDays } from "@/lib/scheduler/dates";
import type { IcsEvent } from "./ics";

export type FeedInput = {
  tasks: CalendarFeedTask[];
  birthdays: BirthdayEntry[];
  /** The user's local date, YYYY-MM-DD. */
  today: string;
  /** e.g. https://asocial.example.com/en — friend links hang off this. */
  localeBaseUrl: string;
  /** digest.line / digest.lineBirthday plus contactTypes.* keys. */
  t: (key: string, values?: Record<string, string>) => string;
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function isLeap(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function buildFeedEvents(input: FeedInput): IcsEvent[] {
  const { today, t, localeBaseUrl } = input;
  const typeT = (key: string) => t(`contactTypes.${key}`);
  const events: IcsEvent[] = [];

  for (const task of input.tasks) {
    // A task whose action window started in the past moves up to today, the
    // way the calendar view shows it — it stays visible instead of sliding
    // off into last week, and nothing turns red. The window's end is kept
    // when it is still ahead.
    const start = task.dueDate < today ? today : task.dueDate;
    const windowEnd = addDays(task.dueDate, Math.max(task.windowDays, 1));
    const end = windowEnd > start ? windowEnd : addDays(start, 1);
    const label = contactTypeLabel(task.type, typeT);
    const url = `${localeBaseUrl}/friends/${task.friendId}`;
    events.push({
      uid: `task-${task.id}@asocial`,
      start,
      end,
      summary: `${task.type.emoji ?? ""} ${t("digest.line", {
        type: label,
        name: task.friendName,
      })}`.trim(),
      description: url,
      url,
    });
  }

  const congratulate = typeT("congratulate");
  for (const birthday of input.birthdays) {
    const feb29 = birthday.birthMonth === 2 && birthday.birthDay === 29;
    // Any real year works as the series anchor; the birth year is used when
    // known. Feb 29 needs a leap-year anchor to be a valid DTSTART.
    const year =
      birthday.birthYear && (!feb29 || isLeap(birthday.birthYear))
        ? birthday.birthYear
        : 2000;
    const start = `${year}-${pad(birthday.birthMonth)}-${pad(birthday.birthDay)}`;
    const url = `${localeBaseUrl}/friends/${birthday.friendId}`;
    events.push({
      uid: `birthday-${birthday.friendId}@asocial`,
      start,
      end: addDays(start, 1),
      // Feb 29 lands on Feb 28 in common years, matching the calendar view.
      rrule: feb29
        ? "FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=-1"
        : "FREQ=YEARLY",
      summary: `🎂 ${t("digest.lineBirthday", {
        name: birthday.name,
        type: congratulate,
      })}`,
      description: url,
      url,
    });
  }

  return events;
}
