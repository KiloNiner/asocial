import { describe, expect, it } from "vitest";
import { z } from "zod";
import { backupSchema } from "@/lib/db/backup-schema";
import { BACKUP_VERSION } from "@/lib/db/queries";

type Backup = z.infer<typeof backupSchema>;

function validBackup(): Backup {
  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    circles: [
      { id: "c1", name: "Close", color: "#0d9488", intervalDays: 14, sortOrder: 1 },
    ],
    friends: [
      {
        id: "f1",
        name: "Ann",
        notes: null,
        intervalOverrideDays: null,
        autoschedule: true,
        archived: false,
        birthMonth: 6,
        birthDay: 15,
        birthYear: 1990,
        createdAt: 1700000000000,
      },
    ],
    friendCircles: [{ friendId: "f1", circleId: "c1" }],
    contactTypes: [
      {
        id: "t1",
        name: "Board games",
        emoji: "🎲",
        defaultWeight: 20,
        sortOrder: 1,
        archived: false,
      },
    ],
    userContactPrefs: [{ contactTypeId: "t1", weight: 50 }],
    circleContactPrefs: [{ circleId: "c1", contactTypeId: "t1", weight: 40 }],
    friendContactPrefs: [{ friendId: "f1", contactTypeId: "t1", weight: 60 }],
    interactions: [
      {
        id: "i1",
        friendId: "f1",
        contactTypeId: "t1",
        occurredOn: "2024-05-01",
        note: "Had coffee",
        taskId: null,
        createdAt: 1700000000000,
      },
    ],
  };
}

function rejects(backup: Backup): boolean {
  return !backupSchema.safeParse(backup).success;
}

describe("backupSchema", () => {
  it("accepts a fully populated, valid backup with one row per table", () => {
    expect(backupSchema.safeParse(validBackup()).success).toBe(true);
  });

  it("rejects a non-hex circle color", () => {
    const b = validBackup();
    b.circles[0].color = "javascript:alert(1)";
    expect(rejects(b)).toBe(true);
  });

  it("rejects an empty circle name", () => {
    const b = validBackup();
    b.circles[0].name = "";
    expect(rejects(b)).toBe(true);
  });

  it("rejects out-of-range circle intervalDays", () => {
    const tooLow = validBackup();
    tooLow.circles[0].intervalDays = 0;
    expect(rejects(tooLow)).toBe(true);

    const tooHigh = validBackup();
    tooHigh.circles[0].intervalDays = 731;
    expect(rejects(tooHigh)).toBe(true);
  });

  it("rejects out-of-range weights", () => {
    const tooLow = validBackup();
    tooLow.userContactPrefs[0].weight = -1;
    expect(rejects(tooLow)).toBe(true);

    const tooHigh = validBackup();
    tooHigh.circleContactPrefs[0].weight = 101;
    expect(rejects(tooHigh)).toBe(true);
  });

  it("rejects out-of-range friend birth fields", () => {
    const badMonth = validBackup();
    badMonth.friends[0].birthMonth = 13;
    expect(rejects(badMonth)).toBe(true);

    const badDay = validBackup();
    badDay.friends[0].birthDay = 32;
    expect(rejects(badDay)).toBe(true);

    const badYear = validBackup();
    badYear.friends[0].birthYear = 1899;
    expect(rejects(badYear)).toBe(true);
  });

  it("rejects a friend with only one half of a birthday set", () => {
    const b = validBackup();
    b.friends[0].birthDay = null;
    expect(rejects(b)).toBe(true);
  });

  it("rejects a friend with a birth year but no birthday", () => {
    const b = validBackup();
    b.friends[0].birthMonth = null;
    b.friends[0].birthDay = null;
    // birthYear (1990) is left set with no birthday — still invalid.
    expect(rejects(b)).toBe(true);
  });

  it("rejects malformed interaction dates", () => {
    const b = validBackup();
    b.interactions[0].occurredOn = "05/01/2024";
    expect(rejects(b)).toBe(true);
  });

  it("rejects notes/note over their length caps", () => {
    const longNotes = validBackup();
    longNotes.friends[0].notes = "x".repeat(5001);
    expect(rejects(longNotes)).toBe(true);

    const longNote = validBackup();
    longNote.interactions[0].note = "x".repeat(10001);
    expect(rejects(longNote)).toBe(true);
  });

  it("accepts a contact type with no emoji (null)", () => {
    const b = validBackup();
    b.contactTypes[0].emoji = null;
    expect(backupSchema.safeParse(b).success).toBe(true);
  });

  it("rejects a contact type emoji that is not a real emoji", () => {
    const b = validBackup();
    b.contactTypes[0].emoji = "lol";
    expect(rejects(b)).toBe(true);
  });

  it("accepts a contact type emoji with a ZWJ/skin-tone sequence", () => {
    const b = validBackup();
    b.contactTypes[0].emoji = "👍🏽";
    expect(backupSchema.safeParse(b).success).toBe(true);
  });
});
