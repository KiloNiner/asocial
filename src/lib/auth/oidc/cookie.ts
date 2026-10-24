import { z } from "zod";
import { routing } from "@/i18n/routing";

export const OIDC_COOKIE = "asocial_oidc";
export const OIDC_COOKIE_TTL_S = 10 * 60;

const flowCookie = z.object({
  state: z.string().min(1),
  nonce: z.string().min(1),
  verifier: z.string().min(1),
  locale: z.enum(routing.locales),
});
export type FlowCookie = z.infer<typeof flowCookie>;

export function parseFlowCookie(raw: string | undefined): FlowCookie | null {
  if (!raw) return null;
  try {
    const parsed = flowCookie.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
