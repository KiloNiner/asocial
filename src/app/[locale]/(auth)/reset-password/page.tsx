import { getTranslations } from "next-intl/server";
import { ResetPasswordForm } from "@/components/auth/AuthForms";
import { Link } from "@/i18n/navigation";

export default async function ResetPasswordPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ token?: string }> }>) {
  const t = await getTranslations("auth");
  const { token } = await searchParams;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{t("resetTitle")}</h1>
      {token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <>
          <p className="rounded-md bg-warn-soft px-3 py-2 text-sm text-warn">
            {t("errors.resetInvalid")}
          </p>
          <Link href="/login" className="text-sm text-accent hover:underline">
            {t("haveAccount")}
          </Link>
        </>
      )}
    </div>
  );
}
