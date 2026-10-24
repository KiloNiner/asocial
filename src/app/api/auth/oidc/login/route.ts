import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { routing } from "@/i18n/routing";
import { appUrl } from "@/lib/app-url";
import { secureCookies } from "@/lib/auth/session";
import { beginAuthorization } from "@/lib/auth/oidc/client";
import { oidcConfig } from "@/lib/auth/oidc/config";
import { OIDC_COOKIE, OIDC_COOKIE_TTL_S } from "@/lib/auth/oidc/cookie";

/** GET /api/auth/oidc/login[?locale=da] — starts the provider round trip. */
export async function GET(request: NextRequest) {
  const requested = request.nextUrl.searchParams.get("locale") ?? "";
  const locale = (routing.locales as readonly string[]).includes(requested)
    ? requested
    : routing.defaultLocale;

  const cfg = oidcConfig();
  if (!cfg) return NextResponse.redirect(`${appUrl()}/${locale}/login`);

  try {
    const { url, flow } = await beginAuthorization(cfg);
    (await cookies()).set(OIDC_COOKIE, JSON.stringify({ ...flow, locale }), {
      httpOnly: true,
      sameSite: "lax", // must accompany the provider's redirect back
      secure: secureCookies(),
      path: "/api/auth/oidc",
      maxAge: OIDC_COOKIE_TTL_S,
    });
    return NextResponse.redirect(url);
  } catch (err) {
    console.error("[auth] sso start failed:", err instanceof Error ? err.message : err);
    return NextResponse.redirect(`${appUrl()}/${locale}/login?sso=unavailable`);
  }
}
