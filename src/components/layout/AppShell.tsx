import { getTranslations } from "next-intl/server";
import { logout } from "@/actions/auth";
import { Link } from "@/i18n/navigation";
import type { User } from "@/db/schema";

const navItems = [
  { href: "/", key: "dashboard" },
  { href: "/calendar", key: "calendar" },
  { href: "/friends", key: "friends" },
  { href: "/circles", key: "circles" },
  { href: "/settings", key: "settings" },
] as const;

export async function AppShell({
  user,
  children,
}: Readonly<{ user: User; children: React.ReactNode }>) {
  const t = await getTranslations("nav");

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="flex w-full shrink-0 flex-col gap-4 border-b border-line bg-panel p-4 md:min-h-screen md:w-52 md:border-b-0 md:border-r">
        <Link href="/" className="text-lg font-bold tracking-tight">
          asocial
        </Link>
        <nav className="flex flex-row flex-wrap gap-1 md:flex-col">
          {navItems.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className="rounded-md px-3 py-1.5 text-sm text-ink hover:bg-faint"
            >
              {t(item.key)}
            </Link>
          ))}
          {user.role === "admin" ? (
            <Link
              href="/admin/invites"
              className="rounded-md px-3 py-1.5 text-sm text-ink hover:bg-faint"
            >
              {t("invites")}
            </Link>
          ) : null}
        </nav>
        <div className="mt-auto flex flex-col gap-2 text-sm">
          <span className="truncate text-muted">{user.displayName}</span>
          <form action={logout}>
            <button
              type="submit"
              className="rounded-md px-3 py-1.5 text-left text-sm text-muted hover:bg-faint"
            >
              {t("logout")}
            </button>
          </form>
        </div>
      </aside>
      <main className="flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
