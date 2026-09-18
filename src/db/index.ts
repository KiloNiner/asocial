import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

function createDb() {
  const sqlite = new Database(process.env.DATABASE_PATH ?? "./dev.db");
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  return drizzle(sqlite, { schema });
}

// Survive Next.js dev-mode HMR without piling up connections.
const globalForDb = globalThis as unknown as {
  __asocialDb?: ReturnType<typeof createDb>;
};

export const db = (globalForDb.__asocialDb ??= createDb());
export { schema };

/**
 * The transaction handle passed to db.transaction(). better-sqlite3 is
 * synchronous, so a callback containing no `await` runs to completion with no
 * other request interleaving — which is what makes check-then-write sequences
 * atomic. Helpers that must be callable both standalone and inside such a
 * transaction take an `Executor`.
 */
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type Executor = typeof db | Tx;
