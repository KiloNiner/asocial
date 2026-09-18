import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { runDailyScheduler } from "@/lib/scheduler/daily-job";
import { runDigestDispatch } from "@/lib/notifications/dispatch";

/** Compares digests rather than raw strings so neither the token's content
 *  nor its length is leaked by how long the comparison takes. */
function secretMatches(expected: string, provided: string | null): boolean {
  if (provided === null) return false;
  const a = createHash("sha256").update(expected).digest();
  const b = createHash("sha256").update(provided).digest();
  return timingSafeEqual(a, b);
}

/**
 * Manual/test trigger for background jobs.
 * POST /api/cron/run?job=scheduler[&force=1] with header x-cron-token.
 */
export async function POST(request: NextRequest) {
  const job = request.nextUrl.searchParams.get("job");
  const force = request.nextUrl.searchParams.get("force") === "1";

  const secret = process.env.CRON_SECRET;
  if (!secret || !secretMatches(secret, request.headers.get("x-cron-token"))) {
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
