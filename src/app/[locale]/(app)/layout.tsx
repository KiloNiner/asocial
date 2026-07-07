import { getLocale } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { AppShell } from "@/components/layout/AppShell";
import { redirect } from "@/i18n/navigation";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();
  if (!user) {
    redirect({ href: "/login", locale: await getLocale() });
    return null;
  }

  return <AppShell user={user}>{children}</AppShell>;
}
