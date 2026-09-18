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
  /** Qualifying items left out of `items` because the digest was full. */
  hiddenCount: number;
};

/**
 * Days between rounds of lingering suggestions, and the arbitrary fixed point
 * their phase is measured from. Any date works; this one just has to stay put,
 * because moving it would shift every user's quiet days at once.
 */
const LINGER_CYCLE_DAYS = 3;
const LINGER_EPOCH: LocalDate = "2026-01-01";

/**
 * How many suggestions one digest will name before it starts counting.
 *
 * A digest that lists everything outstanding stops being a digest and becomes
 * the pile, delivered. Five is roughly what a Pushover notification shows
 * without truncation, and about as much as anyone acts on in one sitting.
 */
export const MAX_DIGEST_ITEMS = 5;

/** True on the days lingering suggestions are allowed to speak up. */
function isLingerDay(today: LocalDate): boolean {
  const days = daysBetween(LINGER_EPOCH, today);
  // JS % takes the sign of the dividend; only tests reach dates before the
  // epoch, but a negative remainder would skew their phase silently.
  const phase = ((days % LINGER_CYCLE_DAYS) + LINGER_CYCLE_DAYS) % LINGER_CYCLE_DAYS;
  return phase === 0;
}

/**
 * Most-actionable first: what just opened, then tomorrow's heads-up, then
 * whatever has been waiting. This orders the *cut*, not the display — when
 * the digest is full, the item that goes is the one that has already been
 * mentioned a dozen times, not today's.
 */
function priority(item: DigestItem, today: LocalDate): number {
  if (item.status === "tomorrow") return 1;
  return item.dueDate === today ? 0 : 2;
}

/**
 * Which pending tasks make today's digest:
 * - tasks whose window opens today, and tomorrow's as a heads-up — always;
 * - everything still pending from before, but only on a linger day.
 *
 * The anti-nag rule used to be per task: each lingering task resurfaced every
 * third day counted from its own due date. That bounds how often *one* task
 * nudges, and bounds nothing about the digest -- with a dozen lingering tasks
 * at staggered ages, some third of them came due every single day, so the
 * digest arrived daily anyway and said much the same thing each time. The
 * rhythm is now shared, so lingering suggestions arrive together and the days
 * between them are genuinely quiet.
 *
 * Returns null when there is nothing to say — then no notification is sent.
 */
export function composeDigest(
  tasks: DigestTask[],
  today: LocalDate,
): Digest | null {
  const tomorrow = addDays(today, 1);
  const lingerDay = isLingerDay(today);
  const items: DigestItem[] = [];

  for (const task of tasks) {
    if (task.dueDate === tomorrow) {
      items.push({ ...task, status: "tomorrow" });
    } else if (task.dueDate === today || (task.dueDate < today && lingerDay)) {
      items.push({ ...task, status: "open" });
    }
  }

  if (items.length === 0) return null;

  items.sort(
    (a, b) =>
      priority(a, today) - priority(b, today) ||
      a.dueDate.localeCompare(b.dueDate),
  );
  const kept = items.slice(0, MAX_DIGEST_ITEMS);
  kept.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  return {
    date: today,
    items: kept,
    hiddenCount: items.length - kept.length,
  };
}
