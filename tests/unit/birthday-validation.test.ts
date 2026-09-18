import { describe, expect, it } from "vitest";
import { isValidBirthday } from "@/lib/validation/birthday";

describe("isValidBirthday", () => {
  it("accepts the last day of every month", () => {
    const lastDays = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    lastDays.forEach((day, i) => {
      expect(isValidBirthday(i + 1, day)).toBe(true);
    });
  });

  it("accepts Feb 29 — a leap-year birthday is a real date", () => {
    expect(isValidBirthday(2, 29)).toBe(true);
  });

  it("rejects Feb 30", () => {
    expect(isValidBirthday(2, 30)).toBe(false);
  });

  it("rejects the 31st of a 30-day month", () => {
    expect(isValidBirthday(4, 31)).toBe(false);
    expect(isValidBirthday(6, 31)).toBe(false);
    expect(isValidBirthday(9, 31)).toBe(false);
    expect(isValidBirthday(11, 31)).toBe(false);
  });

  it("rejects out-of-range months", () => {
    expect(isValidBirthday(0, 1)).toBe(false);
    expect(isValidBirthday(13, 1)).toBe(false);
    expect(isValidBirthday(-1, 1)).toBe(false);
  });

  it("rejects out-of-range days", () => {
    expect(isValidBirthday(1, 0)).toBe(false);
    expect(isValidBirthday(1, 32)).toBe(false);
  });

  it("rejects non-integers", () => {
    expect(isValidBirthday(1.5, 1)).toBe(false);
    expect(isValidBirthday(1, 1.5)).toBe(false);
    expect(isValidBirthday(NaN, 1)).toBe(false);
  });
});
