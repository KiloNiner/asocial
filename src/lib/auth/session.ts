import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/db";
import { sessions, users, type User } from "@/db/schema";
import { generateToken, hashToken } from "./tokens";

export const SESSION_COOKIE = "asocial_session";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const RENEWAL_THRESHOLD_MS = 15 * 24 * 60 * 60 * 1000; // renew when <15 days left

function secureCookies(): boolean {
  return (process.env.APP_URL ?? "").startsWith("https://");
}

export async function createSession(userId: string): Promise<void> {
  const token = generateToken();
  const expiresAt = Date.now() + SESSION_TTL_MS;
  db.insert(sessions)
    .values({ id: hashToken(token), userId, expiresAt })
    .run();

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookies(),
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function validateSession(): Promise<User | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const sessionId = hashToken(token);
  const row = db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.id, sessionId))
    .get();
  if (!row) return null;

  if (row.session.expiresAt <= Date.now()) {
    db.delete(sessions).where(eq(sessions.id, sessionId)).run();
    return null;
  }

  // Sliding renewal: extend the DB expiry; the cookie itself is refreshed on
  // the next login (cookies cannot be set during RSC render).
  if (row.session.expiresAt - Date.now() < RENEWAL_THRESHOLD_MS) {
    db.update(sessions)
      .set({ expiresAt: Date.now() + SESSION_TTL_MS })
      .where(eq(sessions.id, sessionId))
      .run();
  }

  return row.user;
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    db.delete(sessions).where(eq(sessions.id, hashToken(token))).run();
  }
  cookieStore.delete(SESSION_COOKIE);
}
