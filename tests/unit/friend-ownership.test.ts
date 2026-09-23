import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Point the db module at a throwaway SQLite file before anything imports it.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "asocial-test-"));
process.env.DATABASE_PATH = path.join(dir, "test.db");

const baseInput = {
  name: "Victim's friend",
  notes: null,
  intervalOverrideDays: null,
  autoschedule: true,
  birthMonth: null,
  birthDay: null,
  birthYear: null,
};

describe("updateFriend ownership", () => {
  let q: typeof import("@/lib/db/queries");
  let attacker: string;
  let victim: string;

  beforeAll(async () => {
    const { runMigrations } = await import("@/db/migrate");
    runMigrations();
    const { db } = await import("@/db");
    const { users } = await import("@/db/schema");
    q = await import("@/lib/db/queries");
    const mkUser = (email: string) =>
      db
        .insert(users)
        .values({ email, passwordHash: "x", displayName: email })
        .returning()
        .get().id;
    attacker = mkUser("attacker@example.com");
    victim = mkUser("victim@example.com");
  });

  afterAll(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("cannot change another user's friend or its circle links", () => {
    const victimCircle = q.createCircle(victim, { name: "Close", color: "#000000", intervalDays: 7 });
    const attackerCircle = q.createCircle(attacker, { name: "Mine", color: "#000000", intervalDays: 7 });
    const friend = q.createFriend(victim, { ...baseInput, circleIds: [victimCircle.id] });

    q.updateFriend(attacker, friend.id, {
      ...baseInput,
      name: "Renamed",
      circleIds: [attackerCircle.id],
    });

    expect(q.getFriend(victim, friend.id)?.name).toBe(baseInput.name);
    expect(q.getFriendCircles(victim, friend.id).map((c) => c.id)).toEqual([victimCircle.id]);
  });

  it("still lets the owner update their friend's circles", () => {
    const circle = q.createCircle(victim, { name: "Work", color: "#000000", intervalDays: 30 });
    const friend = q.createFriend(victim, { ...baseInput, circleIds: [] });

    q.updateFriend(victim, friend.id, { ...baseInput, circleIds: [circle.id] });

    expect(q.getFriendCircles(victim, friend.id).map((c) => c.id)).toEqual([circle.id]);
  });
});
