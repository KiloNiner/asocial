import { Cron } from "croner";
import { runDailyScheduler, schedulerRanToday } from "./scheduler/daily-job";
import { runDigestDispatch } from "./notifications/dispatch";

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
    const startedAt = Date.now();
    try {
      const stats = runDailyScheduler();
      console.log(
        "[cron] scheduler run complete:",
        JSON.stringify({ ...stats, durationMs: Date.now() - startedAt }),
      );
    } catch (err) {
      console.error(
        "[cron] scheduler run failed:",
        JSON.stringify({ durationMs: Date.now() - startedAt }),
        err,
      );
    }
  });

  new Cron("5 * * * *", { timezone, name: "digest" }, async () => {
    const startedAt = Date.now();
    try {
      const stats = await runDigestDispatch();
      console.log(
        "[cron] digest run complete:",
        JSON.stringify({ ...stats, durationMs: Date.now() - startedAt }),
      );
    } catch (err) {
      console.error(
        "[cron] digest run failed:",
        JSON.stringify({ durationMs: Date.now() - startedAt }),
        err,
      );
    }
  });

  // Boot catch-up: a container that was off at 04:30 still schedules today.
  if (!schedulerRanToday()) {
    const startedAt = Date.now();
    try {
      const stats = runDailyScheduler();
      console.log(
        "[cron] boot catch-up scheduler run complete:",
        JSON.stringify({ ...stats, durationMs: Date.now() - startedAt }),
      );
    } catch (err) {
      console.error(
        "[cron] boot catch-up scheduler run failed:",
        JSON.stringify({ durationMs: Date.now() - startedAt }),
        err,
      );
    }
  }
}
