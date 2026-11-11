import { getLocale, getTranslations } from "next-intl/server";
import { isBootstrap } from "@/actions/auth";
import { RegisterForm } from "@/components/auth/AuthForms";
import { linkClass } from "@/components/ui/classes";
import { Link, redirect } from "@/i18n/navigation";
import { passwordLoginEnabled } from "@/lib/auth/oidc/config";
import { smtpConfigured } from "@/lib/notifications/channel";

export default async function RegisterPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ invite?: string }> }>) {
  // SSO-only deployment: accounts come from the provider, not this form.
  if (!passwordLoginEnabled()) {
    return redirect({ href: "/login", locale: await getLocale() });
  }
  const t = await getTranslations("auth");
  const { invite } = await searchParams;
  const bootstrap = await isBootstrap();

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-xl font-extrabold tracking-tight">{t("registerTitle")}</h1>
      <RegisterForm
        invite={invite}
        bootstrap={bootstrap}
        emailDigest={smtpConfigured()}
      />
      <Link href="/login" className={`${linkClass} text-sm`}>
        {t("haveAccount")}
      </Link>
    </div>
  );
}
