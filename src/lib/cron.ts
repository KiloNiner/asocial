import { Cron } from "croner";
import { runDailyScheduler, schedulerRanToday } from "./scheduler/daily-job";

const globalForCron = globalThis as unknown as {
  __asocialCronStarted?: boolean;
};

/**
 * In-process background jobs, started once from instrumentation. The
 * next start process is always alive, so these fire without web traffic.
 */
export function startCronJobs(): void {
  if (globalForCron.__asocialCronStarted) return;
  globalForCron.__asocialCronStarted = true;

  const timezone = process.env.TZ ?? "Europe/Copenhagen";

  new Cron("30 4 * * *", { timezone, name: "scheduler" }, () => {
    try {
      const stats = runDailyScheduler();
      console.log("[cron] scheduler:", JSON.stringify(stats));
    } catch (err) {
      console.error("[cron] scheduler failed:", err);
    }
  });

  // Boot catch-up: a container that was off at 04:30 still schedules today.
  if (!schedulerRanToday()) {
    try {
      const stats = runDailyScheduler();
      console.log("[cron] boot catch-up scheduler:", JSON.stringify(stats));
    } catch (err) {
      console.error("[cron] boot catch-up failed:", err);
    }
  }
}
