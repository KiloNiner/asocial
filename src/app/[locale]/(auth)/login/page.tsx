import { getTranslations } from "next-intl/server";
import { isBootstrap } from "@/actions/auth";
import { LoginForm } from "@/components/auth/AuthForms";
import { Link } from "@/i18n/navigation";

export default async function LoginPage() {
  const t = await getTranslations("auth");
  const bootstrap = await isBootstrap();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{t("loginTitle")}</h1>
      <LoginForm />
      {bootstrap ? (
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
