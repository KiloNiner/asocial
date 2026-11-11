"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { Icon, type IconName } from "@/components/ui/Icon";

export type NavItem = { href: string; label: string; icon: IconName };

/** "/" is only ever itself; every other item also owns its sub-pages. */
export function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Vertical nav for the desktop sidebar and the mobile menu sheet. */
export function NavLinks({
  items,
  onNavigate,
}: Readonly<{ items: NavItem[]; onNavigate?: () => void }>) {
  const pathname = usePathname();

  return (
    <>
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
              active
                ? "bg-accent-soft font-bold text-accent-ink"
                : "font-medium text-muted hover:bg-faint hover:text-ink"
            }`}
          >
            <Icon name={item.icon} />
            {item.label}
          </Link>
        );
      })}
    </>
  );
}

/** Thumb-reach tab bar; the top bar's menu holds everything it leaves out. */
export function TabBar({ items }: Readonly<{ items: NavItem[] }>) {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-panel/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <div
        className="mx-auto grid max-w-lg"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center gap-0.5 px-1 pb-1.5 pt-2 text-[11px] transition-colors ${
                active ? "font-bold text-accent" : "font-medium text-muted"
              }`}
            >
              <span
                className={`flex h-7 w-12 items-center justify-center rounded-full transition-colors ${
                  active ? "bg-accent-soft text-accent-ink" : ""
                }`}
              >
                <Icon name={item.icon} size={20} />
              </span>
              <span className="max-w-full truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
