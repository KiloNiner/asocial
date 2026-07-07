import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";

export type LocalDate = string; // YYYY-MM-DD

/**
 * Today's calendar date in the given timezone. FAKE_TODAY (test/QA only)
 * freezes the date globally; it is honored nowhere else in the codebase.
 */
export function today(timezone: string): LocalDate {
  const fake = process.env.FAKE_TODAY;
  if (fake && /^\d{4}-\d{2}-\d{2}$/.test(fake)) return fake;
  return format(new TZDate(Date.now(), timezone), "yyyy-MM-dd");
}
