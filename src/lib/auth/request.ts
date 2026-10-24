import { headers } from "next/headers";

/** Zero the last IPv4 octet / collapse IPv6 to its /64 — enough to spot
 *  abuse patterns from a subnet without logging a re-identifiable address. */
export function maskIp(ip: string): string {
  if (ip.includes(":")) {
    return `${ip.split(":").slice(0, 4).join(":")}::`;
  }
  const parts = ip.split(".");
  return parts.length === 4 ? `${parts.slice(0, 3).join(".")}.0` : ip;
}

/** First character plus domain — enough for an operator who knows their own
 *  users to tell which account is being hit, without writing the address to
 *  disk in full. Mirrors the intent of maskIp(). */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at <= 0) return "***";
  return `${email[0]}***${email.slice(at)}`;
}

/**
 * The caller's IP, unmasked. Rate limiting needs the exact address (a /24 is
 * shared by everyone behind one NAT), so masking happens at the log site
 * rather than here — this value must never be passed to console directly.
 */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}
