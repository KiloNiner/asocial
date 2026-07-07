import { describe, expect, it } from "vitest";
import { composeDigest, type DigestTask } from "@/lib/notifications/digest";

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
  const today = "2026-07-10";

  it("returns null when nothing is open or due tomorrow", () => {
    expect(composeDigest([], today)).toBeNull();
    expect(composeDigest([task("a", "2026-07-20")], today)).toBeNull();
  });

  it("includes tasks whose window opens today", () => {
    const digest = composeDigest([task("a", "2026-07-10")], today)!;
    expect(digest.items).toHaveLength(1);
    expect(digest.items[0].status).toBe("open");
  });

  it("includes tomorrow's tasks as a heads-up", () => {
    const digest = composeDigest([task("a", "2026-07-11")], today)!;
    expect(digest.items[0].status).toBe("tomorrow");
  });

  it("re-nudges lingering tasks only every 3rd day", () => {
    // opened 2026-07-04: ages 6 -> included; 5,4 -> not
    expect(composeDigest([task("a", "2026-07-04")], today)).not.toBeNull();
    expect(composeDigest([task("a", "2026-07-05")], today)).toBeNull();
    expect(composeDigest([task("a", "2026-07-06")], today)).toBeNull();
    expect(composeDigest([task("a", "2026-07-07")], today)).not.toBeNull();
  });

  it("sorts by due date and mixes kinds", () => {
    const digest = composeDigest(
      [
        task("late", "2026-07-04"),
        task("bday", "2026-07-11", "birthday"),
        task("today", "2026-07-10"),
      ],
      today,
    )!;
    expect(digest.items.map((item) => item.id)).toEqual([
      "late",
      "today",
      "bday",
    ]);
  });
});
