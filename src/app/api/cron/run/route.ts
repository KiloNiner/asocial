import { NextRequest, NextResponse } from "next/server";
import { runDailyScheduler } from "@/lib/scheduler/daily-job";

/**
 * Manual/test trigger for background jobs.
 * POST /api/cron/run?job=scheduler[&force=1] with header x-cron-token.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("x-cron-token") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const job = request.nextUrl.searchParams.get("job");
  const force = request.nextUrl.searchParams.get("force") === "1";

  switch (job) {
    case "scheduler":
      return NextResponse.json(runDailyScheduler(force));
    default:
      return NextResponse.json({ error: "unknown job" }, { status: 400 });
  }
}
