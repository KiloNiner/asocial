import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { exportUserData } from "@/lib/db/queries";

/** Downloads the current user's data as a JSON backup file. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const data = exportUserData(user.id);
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="asocial-backup-${date}.json"`,
    },
  });
}
