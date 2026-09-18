import type { LocalDate } from "./clock";
import { daysBetween } from "./dates";

/** A pending contact suggestion, as far as the backlog is concerned. */
export type BacklogTask = { dueDate: LocalDate; windowDays: number };

export type BacklogSummary = {
  /** Open suggestions — anything whose window has begun. */
  open: number;
  /** Of those, the ones that have been waiting well past their window. */
  lingering: number;
  /** Active friends asocial schedules for. */
  scheduled: number;
  /** Age in days of the oldest open suggestion; 0 when there are none. */
  oldestDays: number;
};

/**
 * How far past its window a suggestion goes before it counts as stalled.
 *
 * A suggestion is *allowed* to linger past its window — that is the
 * guilt-free rule working as intended, not a failure — so "behind" has to
 * mean well past it rather than merely past it.
 */
const LINGER_FACTOR = 2;

/** Fewer than this and there is no pile, whatever the proportion says. */
export const BACKLOG_MIN_TASKS = 5;

/** ...and it has to be most of the address book, not a couple of stragglers. */
export const BACKLOG_SHARE = 0.4;

export function summarizeBacklog(
  pending: BacklogTask[],
  scheduled: number,
  today: LocalDate,
): BacklogSummary {
  let open = 0;
  let lingering = 0;
  let oldestDays = 0;
  for (const task of pending) {
    const age = daysBetween(task.dueDate, today);
    if (age < 0) continue; // not open yet
    open++;
    if (age > task.windowDays * LINGER_FACTOR) lingering++;
    if (age > oldestDays) oldestDays = age;
  }
  return { open, lingering, scheduled, oldestDays };
}

/**
 * Whether enough of someone's rhythm has stalled that offering to start over
 * is a kindness rather than a nag.
 *
 * Both halves matter. The floor keeps the offer away from someone with three
 * friends and three stale suggestions, who does not have a pile so much as a
 * quiet month. The share is what makes it scale: five stalled out of forty is
 * an ordinary lapse, five out of six is someone who has stopped.
 */
export function isBehind({ lingering, scheduled }: BacklogSummary): boolean {
  if (lingering < BACKLOG_MIN_TASKS) return false;
  return lingering >= Math.ceil(scheduled * BACKLOG_SHARE);
}
