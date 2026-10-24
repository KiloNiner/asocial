import { getLocale, getTranslations } from "next-intl/server";
import { isBootstrap } from "@/actions/auth";
import { LoginForm } from "@/components/auth/AuthForms";
import { Link } from "@/i18n/navigation";
import { oidcConfig, passwordLoginEnabled } from "@/lib/auth/oidc/config";

// Callback ?sso= codes -> auth.errors keys. Anything else is ignored, so the
// query string can't be used to put arbitrary text on the page.
const SSO_ERRORS: Record<string, string> = {
  unavailable: "ssoUnavailable",
  expired: "ssoExpired",
  failed: "ssoFailed",
  noEmail: "ssoNoEmail",
  emailUnverified: "ssoEmailUnverified",
  noAccount: "ssoNoAccount",
};

export default async function LoginPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ sso?: string }> }>) {
  const t = await getTranslations("auth");
  const locale = await getLocale();
  const bootstrap = await isBootstrap();
  const sso = oidcConfig();
  const passwords = passwordLoginEnabled();
  const { sso: ssoCode } = await searchParams;
  const errorKey = ssoCode ? SSO_ERRORS[ssoCode] : undefined;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{t("loginTitle")}</h1>
      {errorKey ? (
        <p className="rounded-md bg-warn-soft px-3 py-2 text-sm text-warn">
          {t(`errors.${errorKey}`)}
        </p>
      ) : null}
      {sso ? (
        // A plain link, not <Link>: this leaves the app, and must not be
        // prefetched (the route sets a cookie and redirects off-site).
        <a
          href={`/api/auth/oidc/login?locale=${locale}`}
          className="w-full rounded-md bg-accent px-3 py-2 text-center text-sm font-medium text-on-accent hover:bg-accent-strong"
        >
          {t("sso", { provider: sso.providerName })}
        </a>
      ) : null}
      {passwords ? <LoginForm /> : null}
      {bootstrap && passwords ? (
        <Link
          href="/register"
          className="text-sm text-accent hover:underline"
        >
          {t("noAccountYet")}
        </Link>
      ) : null}
    </div>
  );
}
