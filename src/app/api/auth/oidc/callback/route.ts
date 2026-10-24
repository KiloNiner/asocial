import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { appUrl } from "@/lib/app-url";
import { clientIp, maskEmail, maskIp } from "@/lib/auth/request";
import { createSession } from "@/lib/auth/session";
import { completeAuthorization } from "@/lib/auth/oidc/client";
import { oidcConfig } from "@/lib/auth/oidc/config";
import { OIDC_COOKIE, parseFlowCookie } from "@/lib/auth/oidc/cookie";
import { resolveSignIn } from "@/lib/auth/oidc/resolve";
import { getSettings } from "@/lib/auth/current-user";

/** GET /api/auth/oidc/callback — the provider sends the browser back here. */
export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const flow = parseFlowCookie(cookieStore.get(OIDC_COOKIE)?.value);
  // Single use: whatever happens next, this flow is spent.
  cookieStore.delete({ name: OIDC_COOKIE, path: "/api/auth/oidc" });

  const locale = flow?.locale ?? "en";
  const fail = (code: string) =>
    NextResponse.redirect(`${appUrl()}/${locale}/login?sso=${code}`);
  const ip = maskIp(await clientIp());

  const cfg = oidcConfig();
  if (!cfg) return fail("unavailable");
  if (!flow) {
    console.warn("[auth] sso login failed:", JSON.stringify({ reason: "noFlow", ip }));
    return fail("expired");
  }

  let identity;
  try {
    identity = await completeAuthorization(cfg, request.nextUrl.search, flow);
  } catch (err) {
    // The message names the protocol failure (state mismatch, bad nonce,
    // provider error) and never contains tokens or the authorization code.
    console.warn(
      "[auth] sso login failed:",
      JSON.stringify({
        reason: "exchange",
        detail: err instanceof Error ? err.message : String(err),
        ip,
      }),
    );
    return fail("failed");
  }

  const outcome = resolveSignIn(cfg, identity, flow.locale);
  if ("error" in outcome) {
    console.warn(
      "[auth] sso login failed:",
      JSON.stringify({
        reason: outcome.error,
        email: identity.email ? maskEmail(identity.email) : null,
        ip,
      }),
    );
    return fail(outcome.error);
  }

  console.log(
    "[auth] sso login succeeded:",
    JSON.stringify({ userId: outcome.userId, how: outcome.how, ip }),
  );
  await createSession(outcome.userId);
  // The account's own locale wins over the one this browser started in.
  const settings = await getSettings(outcome.userId);
  return NextResponse.redirect(`${appUrl()}/${settings.locale}`);
}
