import { NextResponse } from "next/server";
import { appUrl } from "@/lib/app-url";
import { findCalendarFeedUser } from "@/lib/auth/calendar-feed";
import { getSettings } from "@/lib/auth/current-user";
import { buildFeedEvents } from "@/lib/calendar/feed";
import { buildIcs } from "@/lib/calendar/ics";
import { listBirthdays, listCalendarFeedTasks } from "@/lib/db/queries";
import { digestTranslator } from "@/lib/notifications/messages";
import { today } from "@/lib/scheduler/clock";

/**
 * A user's subscribable .ics feed. Calendar apps can't carry a session
 * cookie, so the secret token in the path is the credential — it is never
 * logged. Unknown and rotated tokens get the same plain 404.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const userId = findCalendarFeedUser(token);
  if (!userId) return new NextResponse("Not found", { status: 404 });

  try {
    const settings = await getSettings(userId);
    const t = digestTranslator(settings.locale);
    const events = buildFeedEvents({
      tasks: listCalendarFeedTasks(userId),
      birthdays: listBirthdays(userId),
      today: today(settings.timezone),
      localeBaseUrl: `${appUrl()}/${settings.locale}`,
      // Keys are built at runtime, which defeats next-intl's key typing.
      t: (key, values) => t(key as Parameters<typeof t>[0], values),
    });
    const body = buildIcs({ name: t("app.name"), now: new Date(), events });
    return new NextResponse(body, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'inline; filename="asocial.ics"',
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error) {
    console.error(
      "[calendar] feed failed:",
      JSON.stringify({ userId, error: String(error) }),
    );
    return new NextResponse("Internal error", { status: 500 });
  }
}
