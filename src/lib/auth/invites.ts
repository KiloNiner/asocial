import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { invites } from "@/db/schema";
import { generateToken, hashToken } from "./tokens";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function createInviteToken(
  createdBy: string,
  email?: string,
): { token: string; expiresAt: number } {
  const token = generateToken();
  const expiresAt = Date.now() + INVITE_TTL_MS;
  db.insert(invites)
    .values({
      tokenHash: hashToken(token),
      email: email || null,
      createdBy,
      expiresAt,
    })
    .run();
  return { token, expiresAt };
}

/** Looks up an unused, unexpired invite. Returns its id, or null. */
export function findRedeemableInvite(token: string): string | null {
  const row = db
    .select({ id: invites.id, expiresAt: invites.expiresAt })
    .from(invites)
    .where(and(eq(invites.tokenHash, hashToken(token)), isNull(invites.usedBy)))
    .get();
  if (!row || row.expiresAt <= Date.now()) return null;
  return row.id;
}

export function markInviteUsed(inviteId: string, userId: string): void {
  db.update(invites)
    .set({ usedBy: userId, usedAt: Date.now() })
    .where(eq(invites.id, inviteId))
    .run();
}
