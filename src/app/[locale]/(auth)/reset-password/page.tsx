import { getTranslations } from "next-intl/server";
import { ResetPasswordForm } from "@/components/auth/AuthForms";
import { errorClass, linkClass } from "@/components/ui/classes";
import { Link } from "@/i18n/navigation";

export default async function ResetPasswordPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ token?: string }> }>) {
  const t = await getTranslations("auth");
  const { token } = await searchParams;

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-xl font-extrabold tracking-tight">{t("resetTitle")}</h1>
      {token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <>
          <p className={errorClass}>
            {t("errors.resetInvalid")}
          </p>
          <Link href="/login" className={`${linkClass} text-sm`}>
            {t("haveAccount")}
          </Link>
        </>
      )}
    </div>
  );
}
