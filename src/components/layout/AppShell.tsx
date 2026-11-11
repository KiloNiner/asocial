import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { logout } from "@/actions/auth";
import { Link } from "@/i18n/navigation";
import { MobileNav } from "@/components/layout/MobileNav";
import {
  NavLinks,
  TabBar,
  type NavItem,
} from "@/components/layout/NavLinks";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import type { User } from "@/db/schema";

function Brand() {
  return (
    <Link
      href="/"
      className="flex items-center gap-2 rounded-lg text-xl font-extrabold tracking-tight"
    >
      <Image src="/mark.svg" alt="" width={26} height={26} className="shrink-0" />
      asocial
    </Link>
  );
}

export async function AppShell({
  user,
  children,
}: Readonly<{ user: User; children: React.ReactNode }>) {
  const t = await getTranslations("nav");

  // The five places you go every day; also the mobile tab bar.
  const primary: NavItem[] = [
    { href: "/", label: t("dashboard"), icon: "dashboard" },
    { href: "/calendar", label: t("calendar"), icon: "calendar" },
    { href: "/friends", label: t("friends"), icon: "friends" },
    { href: "/circles", label: t("circles"), icon: "circles" },
    { href: "/settings", label: t("settings"), icon: "settings" },
  ];
  const secondary: NavItem[] = [
    ...(user.role === "admin"
      ? [{ href: "/admin", label: t("admin"), icon: "admin" } as const]
      : []),
    { href: "/about", label: t("about"), icon: "about" },
  ];

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Small screens: brand + full menu on top, tab bar at the thumb. The bar
          stays opaque: a backdrop-filter would become the containing block for
          the menu's fixed backdrop and shrink it to the bar. */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-panel px-4 py-2 md:hidden">
        <Brand />
        <MobileNav
          items={[...primary, ...secondary]}
          displayName={user.displayName}
          logoutAction={logout}
          logoutLabel={t("logout")}
          menuLabel={t("menu")}
        />
      </header>

      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-6 border-r border-line bg-panel p-4 md:flex">
        <div className="px-2 pt-2">
          <Brand />
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
          <NavLinks items={primary} />
          <div className="mx-3 my-2 border-t border-line" />
          <NavLinks items={secondary} />
        </nav>
        <div className="flex items-center gap-2 rounded-xl bg-faint p-2">
          <Avatar name={user.displayName} size="sm" />
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">
            {user.displayName}
          </span>
          <form action={logout} className="flex">
            <button
              type="submit"
              title={t("logout")}
              aria-label={t("logout")}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-panel hover:text-ink"
            >
              <Icon name="logout" size={17} />
            </button>
          </form>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-4 pb-28 pt-5 sm:px-6 md:px-10 md:pb-12 md:pt-9">
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </main>

      <TabBar items={primary} />
    </div>
  );
}
