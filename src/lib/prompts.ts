import { cookies } from "next/headers";

/**
 * Prompts the dashboard may raise, and that the reader can put away.
 *
 * Dismissal lives in a cookie rather than the database on purpose: it is a
 * statement about one browser's clutter, not user data worth exporting or
 * restoring, and keeping it out of the schema means a prompt can be added or
 * retired without a migration. Losing it (new device, cleared cookies) costs
 * one more look at a prompt, which is the harmless direction to fail in.
 */
export const PROMPT_KEYS = ["digestOff"] as const;
export type PromptKey = (typeof PROMPT_KEYS)[number];

export const DISMISSED_COOKIE = "asocial_dismissed";
export const DISMISSED_MAX_AGE = 60 * 60 * 24 * 180; // half a year

export function isPromptKey(value: string): value is PromptKey {
  return (PROMPT_KEYS as readonly string[]).includes(value);
}

/** Unknown entries are dropped, so a retired prompt key can't linger. */
export async function dismissedPrompts(): Promise<Set<PromptKey>> {
  const raw = (await cookies()).get(DISMISSED_COOKIE)?.value ?? "";
  return new Set(raw.split(",").filter(isPromptKey));
}
