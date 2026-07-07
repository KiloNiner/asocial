import { describe, expect, it } from "vitest";
import { effectiveInterval, governingCircle } from "@/lib/scheduler/interval";
import { jitteredInterval, uniformInt } from "@/lib/scheduler/jitter";
import {
  pickActivityType,
  resolveWeight,
} from "@/lib/scheduler/activity-picker";
import { ageOn, nextBirthday } from "@/lib/scheduler/birthday";
import { addDays, daysBetween } from "@/lib/scheduler/dates";
import type { Circle } from "@/db/schema";

/** Deterministic rng for reproducible tests. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function circle(id: string, intervalDays: number): Circle {
  return {
    id,
    userId: "u1",
    name: id,
    color: "#000000",
    intervalDays,
    sortOrder: 0,
  };
}

const settings = { defaultIntervalDays: 30 };

describe("effectiveInterval", () => {
  it("uses the personal override above everything", () => {
    const result = effectiveInterval(
      { intervalOverrideDays: 21 },
      [circle("close", 14)],
      settings,
    );
    expect(result).toEqual({ days: 21, source: { kind: "override" } });
  });

  it("picks the most frequent circle when several apply", () => {
    const close = circle("close", 14);
    const gamers = circle("gamers", 30);
    const result = effectiveInterval(
      { intervalOverrideDays: null },
      [gamers, close],
      settings,
    );
    expect(result.days).toBe(14);
    expect(result.source).toEqual({ kind: "circle", circle: close });
  });

  it("falls back to the user default with no circles", () => {
    const result = effectiveInterval({ intervalOverrideDays: null }, [], settings);
    expect(result).toEqual({ days: 30, source: { kind: "default" } });
  });

  it("governingCircle is null under an override or without circles", () => {
    expect(governingCircle({ intervalOverrideDays: 5 }, [circle("c", 7)])).toBeNull();
    expect(governingCircle({ intervalOverrideDays: null }, [])).toBeNull();
    expect(
      governingCircle({ intervalOverrideDays: null }, [circle("c", 7)])?.id,
    ).toBe("c");
  });
});

describe("jitteredInterval", () => {
  it("stays within ±jitter% for many draws", () => {
    const rng = mulberry32(1);
    for (let i = 0; i < 1000; i++) {
      const days = jitteredInterval(20, 25, rng);
      expect(days).toBeGreaterThanOrEqual(15);
      expect(days).toBeLessThanOrEqual(25);
    }
  });

  it("actually varies (not constant)", () => {
    const rng = mulberry32(2);
    const draws = new Set(
      Array.from({ length: 50 }, () => jitteredInterval(30, 25, rng)),
    );
    expect(draws.size).toBeGreaterThan(5);
  });

  it("never returns less than one day", () => {
    const rng = mulberry32(3);
    for (let i = 0; i < 100; i++) {
      expect(jitteredInterval(1, 30, rng)).toBeGreaterThanOrEqual(1);
    }
  });

  it("uniformInt covers the inclusive range", () => {
    const rng = mulberry32(4);
    const seen = new Set(Array.from({ length: 200 }, () => uniformInt(1, 3, rng)));
    expect([...seen].sort()).toEqual([1, 2, 3]);
  });
});

const types = [
  { id: "message", defaultWeight: 30, archived: false },
  { id: "call", defaultWeight: 25, archived: false },
  { id: "coffee", defaultWeight: 20, archived: false },
  { id: "host_visit", defaultWeight: 5, archived: false },
  { id: "congratulate", defaultWeight: 0, archived: false },
  { id: "old_type", defaultWeight: 50, archived: true },
];

const empty = new Map<string, number>();
const noSources = { friendPrefs: empty, circlePrefs: empty, userPrefs: empty };

describe("resolveWeight", () => {
  const type = { id: "call", defaultWeight: 25, archived: false };

  it("resolves friend > circle > user > default", () => {
    expect(
      resolveWeight(type, {
        friendPrefs: new Map([["call", 1]]),
        circlePrefs: new Map([["call", 2]]),
        userPrefs: new Map([["call", 3]]),
      }),
    ).toBe(1);
    expect(
      resolveWeight(type, {
        friendPrefs: empty,
        circlePrefs: new Map([["call", 2]]),
        userPrefs: new Map([["call", 3]]),
      }),
    ).toBe(2);
    expect(
      resolveWeight(type, {
        friendPrefs: empty,
        circlePrefs: empty,
        userPrefs: new Map([["call", 3]]),
      }),
    ).toBe(3);
    expect(resolveWeight(type, noSources)).toBe(25);
  });

  it("a friend-level 0 beats a circle boost", () => {
    expect(
      resolveWeight(type, {
        friendPrefs: new Map([["call", 0]]),
        circlePrefs: new Map([["call", 90]]),
        userPrefs: empty,
      }),
    ).toBe(0);
  });
});

describe("pickActivityType", () => {
  it("never picks zero-weight, archived, or congratulate types", () => {
    const rng = mulberry32(5);
    for (let i = 0; i < 500; i++) {
      const picked = pickActivityType(types, noSources, null, rng);
      expect(["message", "call", "coffee", "host_visit"]).toContain(picked);
    }
  });

  it("never repeats the last type when alternatives exist", () => {
    const rng = mulberry32(6);
    for (let i = 0; i < 500; i++) {
      expect(pickActivityType(types, noSources, "message", rng)).not.toBe(
        "message",
      );
    }
  });

  it("repeats the last type when it is the only option", () => {
    const only = [{ id: "message", defaultWeight: 10, archived: false }];
    expect(pickActivityType(only, noSources, "message", mulberry32(7))).toBe(
      "message",
    );
  });

  it("returns null when every weight is zero", () => {
    const sources = {
      ...noSources,
      userPrefs: new Map(types.map((t) => [t.id, 0])),
    };
    expect(pickActivityType(types, sources, null, mulberry32(8))).toBeNull();
  });

  it("respects boosted weights in distribution", () => {
    const rng = mulberry32(9);
    const sources = {
      ...noSources,
      friendPrefs: new Map([
        ["coffee", 90],
        ["message", 5],
        ["call", 5],
        ["host_visit", 0],
      ]),
    };
    let coffee = 0;
    for (let i = 0; i < 1000; i++) {
      if (pickActivityType(types, sources, null, rng) === "coffee") coffee++;
    }
    expect(coffee).toBeGreaterThan(800);
  });

  it("distribution roughly matches default weights", () => {
    const rng = mulberry32(10);
    const counts = new Map<string, number>();
    for (let i = 0; i < 8000; i++) {
      const picked = pickActivityType(types, noSources, null, rng)!;
      counts.set(picked, (counts.get(picked) ?? 0) + 1);
    }
    // message:call:coffee:host_visit = 30:25:20:5 of 80 total
    expect(counts.get("message")! / 8000).toBeCloseTo(30 / 80, 1);
    expect(counts.get("host_visit")! / 8000).toBeCloseTo(5 / 80, 1);
  });
});

describe("nextBirthday", () => {
  it("returns this year's date when still ahead", () => {
    expect(nextBirthday(11, 7, "2026-07-07")).toBe("2026-11-07");
  });

  it("returns today when the birthday is today", () => {
    expect(nextBirthday(7, 7, "2026-07-07")).toBe("2026-07-07");
  });

  it("rolls to next year when already passed", () => {
    expect(nextBirthday(3, 12, "2026-07-07")).toBe("2027-03-12");
  });

  it("celebrates Feb 29 on Feb 28 in non-leap years", () => {
    expect(nextBirthday(2, 29, "2026-01-01")).toBe("2026-02-28");
    expect(nextBirthday(2, 29, "2028-01-01")).toBe("2028-02-29");
  });

  it("Feb-29 birthday just after Feb 28 in a non-leap year rolls forward", () => {
    expect(nextBirthday(2, 29, "2026-03-01")).toBe("2027-02-28");
  });

  it("ageOn computes the age turned", () => {
    expect(ageOn(1988, "2026-02-28")).toBe(38);
  });
});

describe("date helpers", () => {
  it("addDays crosses months and years", () => {
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(addDays("2026-07-07", -7)).toBe("2026-06-30");
  });

  it("daysBetween is signed", () => {
    expect(daysBetween("2026-07-01", "2026-07-08")).toBe(7);
    expect(daysBetween("2026-07-08", "2026-07-01")).toBe(-7);
  });

  it("handles DST transitions (dates are calendar-level)", () => {
    // Danish DST switch on 2026-03-29
    expect(daysBetween("2026-03-28", "2026-03-30")).toBe(2);
    expect(addDays("2026-03-28", 2)).toBe("2026-03-30");
  });
});
