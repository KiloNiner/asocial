import { and, eq, isNull } from "drizzle-orm";
import { db, type Executor } from "@/db";
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

/**
 * Looks up an unused, unexpired invite. Returns its id, or null.
 *
 * Pass the enclosing transaction when the caller goes on to redeem it —
 * looking up and marking used across an `await` lets two concurrent
 * registrations redeem the same single-use invite.
 */
export function findRedeemableInvite(
  token: string,
  exec: Executor = db,
): string | null {
  const row = exec
    .select({ id: invites.id, expiresAt: invites.expiresAt })
    .from(invites)
    .where(and(eq(invites.tokenHash, hashToken(token)), isNull(invites.usedBy)))
    .get();
  if (!row || row.expiresAt <= Date.now()) return null;
  return row.id;
}

export function markInviteUsed(
  inviteId: string,
  userId: string,
  exec: Executor = db,
): void {
  exec
    .update(invites)
    .set({ usedBy: userId, usedAt: Date.now() })
    .where(eq(invites.id, inviteId))
    .run();
}
