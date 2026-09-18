import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/scheduler/dates";
import {
  composeDigest,
  MAX_DIGEST_ITEMS,
  type DigestTask,
} from "@/lib/notifications/digest";

function task(id: string, dueDate: string, kind: "contact" | "birthday" = "contact"): DigestTask {
  return {
    id,
    kind,
    dueDate,
    friendName: id,
    typeEmoji: "☕",
    typeLabel: "Coffee",
  };
}

describe("composeDigest", () => {
  // 2026-07-12 is a whole number of 3-day cycles from the epoch the linger
  // rhythm is measured from, so it is a day lingering suggestions may speak
  // up; the two days after it are quiet.
  const today = "2026-07-12";
  const quiet = "2026-07-13";

  it("returns null when nothing is open or due tomorrow", () => {
    expect(composeDigest([], today)).toBeNull();
    expect(composeDigest([task("a", "2026-07-20")], today)).toBeNull();
  });

  it("includes tasks whose window opens today", () => {
    const digest = composeDigest([task("a", today)], today)!;
    expect(digest.items).toHaveLength(1);
    expect(digest.items[0].status).toBe("open");
  });

  it("includes tomorrow's tasks as a heads-up", () => {
    const digest = composeDigest([task("a", "2026-07-13")], today)!;
    expect(digest.items[0].status).toBe("tomorrow");
  });

  it("opens today's window and tomorrow's heads-up on a quiet day too", () => {
    expect(composeDigest([task("a", quiet)], quiet)).not.toBeNull();
    expect(composeDigest([task("a", "2026-07-14")], quiet)).not.toBeNull();
  });

  it("re-nudges lingering tasks only on shared linger days", () => {
    const lingering = [task("a", "2026-07-06")];
    expect(composeDigest(lingering, today)).not.toBeNull();
    expect(composeDigest(lingering, "2026-07-13")).toBeNull();
    expect(composeDigest(lingering, "2026-07-14")).toBeNull();
    expect(composeDigest(lingering, "2026-07-15")).not.toBeNull();
  });

  it("keeps lingering tasks of different ages on the same rhythm", () => {
    // The old rule counted every third day from each task's own due date, so
    // a spread of ages meant something came due every single day and the
    // digest never went quiet. These four have ages 1 to 4 today.
    const staggered = [
      task("a", "2026-07-11"),
      task("b", "2026-07-10"),
      task("c", "2026-07-09"),
      task("d", "2026-07-08"),
    ];
    expect(composeDigest(staggered, today)!.items).toHaveLength(4);
    expect(composeDigest(staggered, "2026-07-13")).toBeNull();
    expect(composeDigest(staggered, "2026-07-14")).toBeNull();
  });

  it("sorts by due date and mixes kinds", () => {
    const digest = composeDigest(
      [
        task("late", "2026-07-06"),
        task("bday", "2026-07-13", "birthday"),
        task("today", today),
      ],
      today,
    )!;
    expect(digest.items.map((item) => item.id)).toEqual([
      "late",
      "today",
      "bday",
    ]);
    expect(digest.hiddenCount).toBe(0);
  });

  it("caps the list and counts the rest", () => {
    const many = Array.from({ length: 9 }, (_, i) =>
      task(`old${i}`, "2026-07-06"),
    );
    const digest = composeDigest(many, today)!;
    expect(digest.items).toHaveLength(MAX_DIGEST_ITEMS);
    expect(digest.hiddenCount).toBe(9 - MAX_DIGEST_ITEMS);
  });

  it("keeps today and tomorrow when the backlog fills the digest", () => {
    // Today's suggestion is the actionable one, so it has to survive a
    // backlog big enough to fill the digest on its own. Of the lingering
    // rest, the ones that have waited longest go in first.
    const digest = composeDigest(
      [
        ...Array.from({ length: 8 }, (_, i) =>
          task(`old${i}`, addDays(today, -30 + i)),
        ),
        task("today", today),
        task("tomorrow", "2026-07-13"),
      ],
      today,
    )!;
    const ids = digest.items.map((item) => item.id);
    expect(ids).toContain("today");
    expect(ids).toContain("tomorrow");
    expect(ids).toContain("old0");
    expect(ids).not.toContain("old7");
    expect(digest.hiddenCount).toBe(5);
  });
});
