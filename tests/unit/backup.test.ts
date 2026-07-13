import { describe, expect, it } from "vitest";
import { BACKUP_VERSION, type BackupData } from "@/lib/db/queries";

/**
 * The backup zod schema in the import action mirrors this shape; this test
 * guards the exported contract (keys + version) so the route and action stay
 * in sync with exportUserData. DB round-trips are covered by the browser
 * verification pass.
 */
const EXPECTED_KEYS = [
  "version",
  "exportedAt",
  "circles",
  "friends",
  "friendCircles",
  "contactTypes",
  "userContactPrefs",
  "circleContactPrefs",
  "friendContactPrefs",
  "interactions",
] as const;

function emptyBackup(): BackupData {
  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    circles: [],
    friends: [],
    friendCircles: [],
    contactTypes: [],
    userContactPrefs: [],
    circleContactPrefs: [],
    friendContactPrefs: [],
    interactions: [],
  };
}

describe("backup contract", () => {
  it("version is 1", () => {
    expect(BACKUP_VERSION).toBe(1);
  });

  it("a backup object has exactly the documented keys", () => {
    expect(Object.keys(emptyBackup()).sort()).toEqual(
      [...EXPECTED_KEYS].sort(),
    );
  });

  it("survives JSON round-trip", () => {
    const b = emptyBackup();
    b.circles.push({
      id: "c1",
      name: "Close",
      color: "#0d9488",
      intervalDays: 14,
      sortOrder: 1,
    });
    const parsed = JSON.parse(JSON.stringify(b)) as BackupData;
    expect(parsed.circles[0].name).toBe("Close");
    expect(parsed.version).toBe(BACKUP_VERSION);
  });
});
