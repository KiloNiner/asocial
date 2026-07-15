import { describe, expect, it } from "vitest";
import { isSingleEmoji } from "@/lib/validation/emoji";

describe("isSingleEmoji", () => {
  it("accepts a plain emoji", () => {
    expect(isSingleEmoji("😀")).toBe(true);
  });

  it("accepts a skin-tone modified emoji", () => {
    expect(isSingleEmoji("👍🏽")).toBe(true);
  });

  it("accepts a ZWJ family sequence", () => {
    expect(isSingleEmoji("👨‍👩‍👧‍👦")).toBe(true);
  });

  it("accepts a flag (regional indicator pair)", () => {
    expect(isSingleEmoji("🇩🇰")).toBe(true);
  });

  it("accepts a keycap sequence", () => {
    expect(isSingleEmoji("1️⃣")).toBe(true);
  });

  it("rejects plain text", () => {
    expect(isSingleEmoji("lol")).toBe(false);
  });

  it("rejects a single plain letter", () => {
    expect(isSingleEmoji("A")).toBe(false);
  });

  it("rejects two concatenated emoji", () => {
    expect(isSingleEmoji("😀😀")).toBe(false);
  });

  it("rejects an emoji with trailing text", () => {
    expect(isSingleEmoji("😀x")).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(isSingleEmoji("")).toBe(false);
  });
});
