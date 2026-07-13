"use client";

import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";

type NavItem = { href: string; label: string };

export function MobileNav({
  navItems,
  adminItem,
  aboutItem,
  displayName,
  logoutAction,
  logoutLabel,
  menuLabel,
}: Readonly<{
  navItems: NavItem[];
  adminItem: NavItem | null;
  aboutItem: NavItem;
  displayName: string;
  logoutAction: () => void | Promise<void>;
  logoutLabel: string;
  menuLabel: string;
}>) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const linkClass = "rounded-md px-3 py-1.5 text-sm text-ink hover:bg-faint";

  return (
    <div className="relative md:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-label={menuLabel}
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 items-center justify-center rounded-md text-ink hover:bg-faint"
      >
        {open ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <line x1="6" y1="6" x2="18" y2="18" />
            <line x1="18" y1="6" x2="6" y2="18" />
          </svg>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        )}
      </button>

      {open ? (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 top-full z-50 mt-2 flex w-56 flex-col gap-1 rounded-xl border border-line bg-panel p-2 shadow-sm">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={linkClass}
              >
                {item.label}
              </Link>
            ))}
            {adminItem ? (
              <Link
                href={adminItem.href}
                onClick={() => setOpen(false)}
                className={linkClass}
              >
                {adminItem.label}
              </Link>
            ) : null}
            <Link
              href={aboutItem.href}
              onClick={() => setOpen(false)}
              className={linkClass}
            >
              {aboutItem.label}
            </Link>
            <div className="my-1 border-t border-line" />
            <span className="truncate px-3 py-1 text-sm text-muted">
              {displayName}
            </span>
            <form
              action={logoutAction}
              onSubmit={() => setOpen(false)}
            >
              <button
                type="submit"
                className="w-full rounded-md px-3 py-1.5 text-left text-sm text-muted hover:bg-faint"
              >
                {logoutLabel}
              </button>
            </form>
          </div>
        </>
      ) : null}
    </div>
  );
}
