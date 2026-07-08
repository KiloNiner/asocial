import { NextRequest, NextResponse } from "next/server";
import { runDailyScheduler } from "@/lib/scheduler/daily-job";
import { runDigestDispatch } from "@/lib/notifications/dispatch";

/**
 * Manual/test trigger for background jobs.
 * POST /api/cron/run?job=scheduler[&force=1] with header x-cron-token.
 */
export async function POST(request: NextRequest) {
  const job = request.nextUrl.searchParams.get("job");
  const force = request.nextUrl.searchParams.get("force") === "1";

  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("x-cron-token") !== secret) {
    console.warn(
      "[cron:manual] rejected unauthorized request:",
      JSON.stringify({ job }),
    );
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  try {
    switch (job) {
      case "scheduler": {
        const stats = runDailyScheduler(force);
        console.log(
          "[cron:manual] scheduler run complete:",
          JSON.stringify({ ...stats, force, durationMs: Date.now() - startedAt }),
        );
        return NextResponse.json(stats);
      }
      case "digest": {
        const stats = await runDigestDispatch(force);
        console.log(
          "[cron:manual] digest run complete:",
          JSON.stringify({ ...stats, force, durationMs: Date.now() - startedAt }),
        );
        return NextResponse.json(stats);
      }
      default:
        return NextResponse.json({ error: "unknown job" }, { status: 400 });
    }
  } catch (err) {
    console.error(
      "[cron:manual] run failed:",
      JSON.stringify({ job, force, durationMs: Date.now() - startedAt }),
      err,
    );
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
