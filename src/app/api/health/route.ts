import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { jobRuns } from "@/db/schema";

export async function GET() {
  try {
    const lastRun = db
      .select({ runDate: jobRuns.runDate, finishedAt: jobRuns.finishedAt })
      .from(jobRuns)
      .where(eq(jobRuns.job, "scheduler"))
      .orderBy(desc(jobRuns.runDate))
      .get();
    return NextResponse.json({
      status: "ok",
      db: "ok",
      lastSchedulerRun: lastRun ?? null,
    });
  } catch {
    return NextResponse.json({ status: "error", db: "error" }, { status: 500 });
  }
}
