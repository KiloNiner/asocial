/**
 * Month/day validation for friend birthdays.
 *
 * The two fields were previously bounded independently (month 1-12, day 1-31),
 * which accepts dates that do not exist — Feb 30, Apr 31. nextBirthday() then
 * builds a string like "2027-04-31", parseISO() rejects it, daysBetween()
 * returns NaN, and the `<= BIRTHDAY_LOOKAHEAD_DAYS` test silently fails: the
 * friend simply never gets a birthday nudge, with nothing logged.
 */

// Feb allows 29 deliberately: a leap-year birthday is a real date, and
// nextBirthday() celebrates it on Feb 28 in common years.
const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export function isValidBirthday(month: number, day: number): boolean {
  if (!Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (month < 1 || month > 12 || day < 1) return false;
  return day <= DAYS_IN_MONTH[month - 1];
}
