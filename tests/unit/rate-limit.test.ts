import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearAttempts,
  isLimited,
  recordAttempt,
  resetAllAttempts,
} from "@/lib/auth/rate-limit";

const LIMIT = { limit: 3, windowMs: 1000 };

beforeEach(() => {
  resetAllAttempts();
  vi.useRealTimers();
});

describe("recordAttempt", () => {
  it("allows exactly `limit` attempts, then refuses", () => {
    expect(recordAttempt("k", LIMIT)).toBe(true);
    expect(recordAttempt("k", LIMIT)).toBe(true);
    expect(recordAttempt("k", LIMIT)).toBe(true);
    expect(recordAttempt("k", LIMIT)).toBe(false);
  });

  it("keeps separate keys independent", () => {
    for (let i = 0; i < 4; i++) recordAttempt("a", LIMIT);
    expect(isLimited("a", LIMIT)).toBe(true);
    expect(isLimited("b", LIMIT)).toBe(false);
  });

  it("forgives the window once it expires", () => {
    vi.useFakeTimers();
    for (let i = 0; i < 4; i++) recordAttempt("k", LIMIT);
    expect(isLimited("k", LIMIT)).toBe(true);

    vi.advanceTimersByTime(LIMIT.windowMs + 1);
    expect(isLimited("k", LIMIT)).toBe(false);
    expect(recordAttempt("k", LIMIT)).toBe(true);
  });
});

describe("isLimited", () => {
  it("is false until the limit is actually exceeded", () => {
    expect(isLimited("k", LIMIT)).toBe(false);
    recordAttempt("k", LIMIT);
    recordAttempt("k", LIMIT);
    recordAttempt("k", LIMIT);
    // Three recorded attempts is at the limit, not over it.
    expect(isLimited("k", LIMIT)).toBe(false);
    recordAttempt("k", LIMIT);
    expect(isLimited("k", LIMIT)).toBe(true);
  });

  it("does not itself count as an attempt", () => {
    for (let i = 0; i < 10; i++) isLimited("k", LIMIT);
    expect(recordAttempt("k", LIMIT)).toBe(true);
  });
});

describe("clearAttempts", () => {
  it("lets a successful login forgive earlier failures", () => {
    for (let i = 0; i < 4; i++) recordAttempt("k", LIMIT);
    expect(isLimited("k", LIMIT)).toBe(true);

    clearAttempts("k");
    expect(isLimited("k", LIMIT)).toBe(false);
    expect(recordAttempt("k", LIMIT)).toBe(true);
  });
});
