import { getTranslations } from "next-intl/server";
import { isBootstrap } from "@/actions/auth";
import { RegisterForm } from "@/components/auth/AuthForms";
import { Link } from "@/i18n/navigation";

export default async function RegisterPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ invite?: string }> }>) {
  const t = await getTranslations("auth");
  const { invite } = await searchParams;
  const bootstrap = await isBootstrap();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{t("registerTitle")}</h1>
      <RegisterForm invite={invite} bootstrap={bootstrap} />
      <Link href="/login" className="text-sm text-accent hover:underline">
        {t("haveAccount")}
      </Link>
    </div>
  );
}
