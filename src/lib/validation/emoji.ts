const SINGLE_EMOJI_RE = /^\p{RGI_Emoji}$/v;

/** True for exactly one emoji grapheme sequence — including skin-tone
 *  modifiers, ZWJ sequences (family/role combos), flags, and keycaps. */
export function isSingleEmoji(value: string): boolean {
  return SINGLE_EMOJI_RE.test(value);
}
