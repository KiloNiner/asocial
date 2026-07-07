/**
 * Seeds the database with deterministic demo data for development and QA.
 * Usage: npm run seed [-- --reset]
 * --reset deletes the database file first.
 */
import fs from "node:fs";

const reset = process.argv.includes("--reset");
const dbPath = process.env.DATABASE_PATH ?? "./dev.db";

if (reset) {
  for (const suffix of ["", "-wal", "-shm"]) {
    fs.rmSync(dbPath + suffix, { force: true });
  }
  console.log(`Removed ${dbPath}`);
}

async function main() {
  const { runMigrations } = await import("../src/db/migrate");
  runMigrations();
  console.log("Migrations applied.");

  // Demo data arrives with M3 (friends/circles/interactions CRUD).
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
