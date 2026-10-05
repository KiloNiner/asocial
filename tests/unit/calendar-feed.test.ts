import { describe, expect, it } from "vitest";
import { buildIcs, escapeText, foldLine } from "@/lib/calendar/ics";
import { buildFeedEvents, type FeedInput } from "@/lib/calendar/feed";
import { digestTranslator } from "@/lib/notifications/messages";
import type { CalendarFeedTask } from "@/lib/db/queries";

const encoder = new TextEncoder();

describe("escapeText", () => {
  it("escapes backslash, semicolon, comma and newlines", () => {
    expect(escapeText("a\\b;c,d\ne\r\nf")).toBe("a\\\\b\\;c\\,d\\ne\\nf");
  });
});

describe("foldLine", () => {
  it("leaves short lines alone", () => {
    expect(foldLine("SUMMARY:hi")).toBe("SUMMARY:hi");
  });

  it("folds at 75 octets without splitting multi-byte characters", () => {
    const line = `SUMMARY:${"🎂æ".repeat(40)}`;
    const folded = foldLine(line);
    const physical = folded.split("\r\n");
    expect(physical.length).toBeGreaterThan(1);
    for (const part of physical) {
      expect(encoder.encode(part).length).toBeLessThanOrEqual(75);
      expect(part).not.toContain("�");
    }
    // Unfolding (drop CRLF + one space) restores the original line.
    expect(folded.replace(/\r\n /g, "")).toBe(line);
  });
});

describe("buildIcs", () => {
  const now = new Date("2026-10-05T12:34:56.789Z");

  it("produces a CRLF-terminated calendar with all-day events", () => {
    const ics = buildIcs({
      name: "asocial",
      now,
      events: [
        {
          uid: "task-1@asocial",
          start: "2026-10-05",
          end: "2026-10-12",
          summary: "☕ Coffee — Ann, Bo",
          url: "https://x.test/en/friends/f1",
        },
      ],
    });
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).not.toMatch(/[^\r]\n/);
    expect(ics).toContain("DTSTAMP:20261005T123456Z");
    expect(ics).toContain("DTSTART;VALUE=DATE:20261005");
    expect(ics).toContain("DTEND;VALUE=DATE:20261012");
    expect(ics).toContain("SUMMARY:☕ Coffee — Ann\\, Bo");
    expect(ics).toContain("TRANSP:TRANSPARENT");
  });

  it("is deterministic for the same input", () => {
    const input = { name: "a", now, events: [] };
    expect(buildIcs(input)).toBe(buildIcs(input));
  });
});

describe("buildFeedEvents", () => {
  const en = digestTranslator("en");
  const t: FeedInput["t"] = (key, values) =>
    en(key as Parameters<typeof en>[0], values);

  function task(over: Partial<CalendarFeedTask> = {}): CalendarFeedTask {
    return {
      id: "t1",
      friendId: "f1",
      friendName: "Ann",
      dueDate: "2026-10-10",
      windowDays: 7,
      type: { id: "coffee", name: null, emoji: "☕" },
      ...over,
    };
  }

  function events(input: Partial<FeedInput>) {
    return buildFeedEvents({
      tasks: [],
      birthdays: [],
      today: "2026-10-05",
      localeBaseUrl: "https://x.test/en",
      t,
      ...input,
    });
  }

  it("spans an upcoming task's action window", () => {
    const [event] = events({ tasks: [task()] });
    expect(event).toMatchObject({
      uid: "task-t1@asocial",
      start: "2026-10-10",
      end: "2026-10-17",
      summary: "☕ Meet for coffee — Ann",
      url: "https://x.test/en/friends/f1",
    });
  });

  it("uses a custom type's own label", () => {
    const [event] = events({
      tasks: [task({ type: { id: "x", name: "Board games", emoji: null } })],
    });
    expect(event.summary).toBe("Board games — Ann");
  });

  it("moves an already-open window's start up to today", () => {
    const [event] = events({ tasks: [task({ dueDate: "2026-10-01" })] });
    expect(event.start).toBe("2026-10-05");
    expect(event.end).toBe("2026-10-08");
  });

  it("keeps a lingering task on today rather than in the past", () => {
    const [event] = events({ tasks: [task({ dueDate: "2026-09-01" })] });
    expect(event.start).toBe("2026-10-05");
    expect(event.end).toBe("2026-10-06");
  });

  it("makes birthdays yearly, anchored on the birth year when known", () => {
    const [known, unknown] = events({
      birthdays: [
        { friendId: "a", name: "Ann", birthDay: 3, birthMonth: 11, birthYear: 1990 },
        { friendId: "b", name: "Bo", birthDay: 3, birthMonth: 11, birthYear: null },
      ],
    });
    expect(known).toMatchObject({
      uid: "birthday-a@asocial",
      start: "1990-11-03",
      end: "1990-11-04",
      rrule: "FREQ=YEARLY",
    });
    expect(known.summary).toBe("🎂 It's Ann's birthday — Wish happy birthday");
    expect(unknown.start).toBe("2000-11-03");
  });

  it("lands Feb 29 birthdays on the last day of February", () => {
    const [leap, nonLeapYear] = events({
      birthdays: [
        { friendId: "a", name: "Ann", birthDay: 29, birthMonth: 2, birthYear: 1996 },
        { friendId: "b", name: "Bo", birthDay: 29, birthMonth: 2, birthYear: 1997 },
      ],
    });
    expect(leap.start).toBe("1996-02-29");
    expect(leap.rrule).toBe("FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=-1");
    // An impossible anchor date falls back to a leap year.
    expect(nonLeapYear.start).toBe("2000-02-29");
  });
});
