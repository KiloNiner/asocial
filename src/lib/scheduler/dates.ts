import { addDays as dfAddDays, format, parseISO } from "date-fns";
import type { LocalDate } from "./clock";

/** Calendar-date arithmetic on YYYY-MM-DD strings (timezone-free). */
export function addDays(date: LocalDate, days: number): LocalDate {
  return format(dfAddDays(parseISO(date), days), "yyyy-MM-dd");
}

/** Whole days from a to b (positive when b is later). */
export function daysBetween(a: LocalDate, b: LocalDate): number {
  const ms = parseISO(b).getTime() - parseISO(a).getTime();
  return Math.round(ms / 86_400_000);
}
