import type { LocalDate } from "@/lib/scheduler/clock";
import { addDays, daysBetween } from "@/lib/scheduler/dates";

export type DigestTask = {
  id: string;
  kind: "contact" | "birthday";
  dueDate: LocalDate;
  friendName: string;
  typeEmoji: string;
  typeLabel: string;
};

export type DigestItem = DigestTask & {
  status: "open" | "tomorrow";
};

export type Digest = {
  date: LocalDate;
  items: DigestItem[];
};

/**
 * Which pending tasks make today's digest:
 * - open tasks on the day the window opens, then only every 3rd day after
 *   while still pending (anti-nag rule — a lingering task must not nudge
 *   daily);
 * - tomorrow's tasks as a heads-up.
 * Returns null when there is nothing to say — then no notification is sent.
 */
export function composeDigest(
  tasks: DigestTask[],
  today: LocalDate,
): Digest | null {
  const tomorrow = addDays(today, 1);
  const items: DigestItem[] = [];

  for (const task of tasks) {
    if (task.dueDate === tomorrow) {
      items.push({ ...task, status: "tomorrow" });
    } else if (task.dueDate <= today) {
      const age = daysBetween(task.dueDate, today);
      if (age % 3 === 0) {
        items.push({ ...task, status: "open" });
      }
    }
  }

  if (items.length === 0) return null;
  items.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  return { date: today, items };
}
