import { addDays } from "./dates";

/**
 * Where a pending task stands relative to today. There is deliberately no
 * "overdue": a window that has passed is merely still open.
 */
export type WindowState = "upcoming" | "open" | "stillOpen";

export function windowState(
  dueDate: string,
  windowDays: number,
  today: string,
): WindowState {
  if (today < dueDate) return "upcoming";
  return today <= addDays(dueDate, windowDays - 1) ? "open" : "stillOpen";
}
