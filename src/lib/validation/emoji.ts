import emojiRegex from "emoji-regex";

// emoji-regex is unanchored/global (built for scanning text for emoji); wrap
// it so the whole trimmed input must be exactly one emoji sequence.
const SINGLE_EMOJI_RE = new RegExp(`^(?:${emojiRegex().source})$`);

/** True for exactly one emoji grapheme sequence — including skin-tone
 *  modifiers, ZWJ sequences (family/role combos), flags, and keycaps. */
export function isSingleEmoji(value: string): boolean {
  return SINGLE_EMOJI_RE.test(value);
}
