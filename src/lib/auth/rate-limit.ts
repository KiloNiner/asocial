/**
 * In-memory fixed-window limiter for unauthenticated credential endpoints.
 *
 * Deliberately process-local: asocial is a single container with no external
 * services, and the jobs already run in-process, so there is nowhere to put a
 * shared counter. A restart forgives outstanding attempts, which is an
 * acceptable trade for not adding a dependency.
 *
 * Verifying a password costs ~19 MiB and a deliberate CPU burn (argon2id), so
 * this caps guessing *and* the unauthenticated work a caller can force.
 */

type Window = { count: number; resetAt: number };

const windows = new Map<string, Window>();

/** Attempts allowed per window, keyed by caller IP and by target account. */
export const LOGIN_LIMITS = {
  perIp: { limit: 20, windowMs: 15 * 60 * 1000 },
  perAccount: { limit: 10, windowMs: 15 * 60 * 1000 },
} as const;

function sweep(now: number): void {
  // Bounded by the number of distinct keys seen in one window; sweeping on
  // write keeps an attacker from growing the map without limit.
  if (windows.size < 1000) return;
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key);
  }
}

/**
 * Records one attempt against `key`. Returns false once the window is spent.
 * Call only for *failed* attempts, and clear() on success, so a normally
 * behaving user can never rate-limit themselves out.
 */
export function recordAttempt(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number },
): boolean {
  const now = Date.now();
  sweep(now);
  const window = windows.get(key);
  if (!window || window.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  window.count++;
  return window.count <= limit;
}

/** True when `key` has already spent its window (checked before doing work). */
export function isLimited(
  key: string,
  { limit }: { limit: number; windowMs: number },
): boolean {
  const window = windows.get(key);
  if (!window || window.resetAt <= Date.now()) return false;
  return window.count > limit;
}

export function clearAttempts(key: string): void {
  windows.delete(key);
}

/** Test seam — the limiter is module state that outlives a single test. */
export function resetAllAttempts(): void {
  windows.clear();
}
