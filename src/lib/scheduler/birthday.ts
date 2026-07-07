import { isLeapYear } from "date-fns";
import type { LocalDate } from "./clock";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Next occurrence of a birthday on or after `from` (YYYY-MM-DD).
 * Feb 29 birthdays are celebrated on Feb 28 in non-leap years.
 */
export function nextBirthday(
  birthMonth: number,
  birthDay: number,
  from: LocalDate,
): LocalDate {
  const fromYear = Number(from.slice(0, 4));

  for (let year = fromYear; ; year++) {
    let month = birthMonth;
    let day = birthDay;
    if (month === 2 && day === 29 && !isLeapYear(new Date(year, 0, 1))) {
      day = 28;
    }
    const candidate = `${year}-${pad(month)}-${pad(day)}`;
    if (candidate >= from) return candidate;
  }
}

/** Age turned on a given birthday occurrence, when the birth year is known. */
export function ageOn(birthYear: number, occurrence: LocalDate): number {
  return Number(occurrence.slice(0, 4)) - birthYear;
}
