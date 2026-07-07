export async function register() {
  // Only in the real Node server process — not edge, not during build.
  if (
    process.env.NEXT_RUNTIME !== "nodejs" ||
    process.env.NEXT_PHASE === "phase-production-build"
  ) {
    return;
  }

  const { runMigrations } = await import("./db/migrate");
  runMigrations();
  console.log("[boot] migrations applied");

  const { startCronJobs } = await import("./lib/cron");
  startCronJobs();
  console.log("[boot] cron jobs started");
}
