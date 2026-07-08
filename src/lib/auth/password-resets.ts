import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { passwordResets } from "@/db/schema";
import { generateToken, hashToken } from "./tokens";

// Shorter-lived than invites: this reset link authorizes a live credential
// change, not just registration.
const RESET_TTL_MS = 24 * 60 * 60 * 1000;

export function createPasswordResetToken(
  createdBy: string,
  userId: string,
): { token: string; expiresAt: number } {
  const token = generateToken();
  const expiresAt = Date.now() + RESET_TTL_MS;
  db.insert(passwordResets)
    .values({ tokenHash: hashToken(token), userId, createdBy, expiresAt })
    .run();
  return { token, expiresAt };
}

/** Looks up an unused, unexpired reset token. Returns its id + target user, or null. */
export function findRedeemableReset(
  token: string,
): { id: string; userId: string } | null {
  const row = db
    .select({
      id: passwordResets.id,
      userId: passwordResets.userId,
      expiresAt: passwordResets.expiresAt,
    })
    .from(passwordResets)
    .where(
      and(
        eq(passwordResets.tokenHash, hashToken(token)),
        isNull(passwordResets.usedAt),
      ),
    )
    .get();
  if (!row || row.expiresAt <= Date.now()) return null;
  return { id: row.id, userId: row.userId };
}

export function markResetUsed(resetId: string): void {
  db.update(passwordResets)
    .set({ usedAt: Date.now() })
    .where(eq(passwordResets.id, resetId))
    .run();
}
