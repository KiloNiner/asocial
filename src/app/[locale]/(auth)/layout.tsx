import Image from "next/image";
import { getTranslations } from "next-intl/server";

export default async function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const t = await getTranslations("app");

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-10">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex items-center gap-2.5 text-4xl font-extrabold tracking-tight">
          <Image src="/mark.svg" alt="" width={44} height={44} priority />
          {t("name")}
        </div>
        <p className="max-w-xs text-sm text-muted">{t("tagline")}</p>
      </div>
      <div className="w-full max-w-sm rounded-2xl border border-line bg-panel p-6 shadow-card sm:p-7">
        {children}
      </div>
    </main>
  );
}
