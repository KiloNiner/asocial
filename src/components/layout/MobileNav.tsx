"use client";

import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import { NavLinks, type NavItem } from "@/components/layout/NavLinks";

/** The full menu behind the top bar's button on small screens. */
export function MobileNav({
  items,
  displayName,
  logoutAction,
  logoutLabel,
  menuLabel,
}: Readonly<{
  items: NavItem[];
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

  return (
    <div className="relative md:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-label={menuLabel}
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 w-10 items-center justify-center rounded-lg text-ink hover:bg-faint"
      >
        <Icon name={open ? "close" : "menu"} size={22} />
      </button>

      {open ? (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full z-50 mt-2 flex w-64 flex-col gap-1 rounded-2xl border border-line bg-panel p-2 shadow-pop">
            <NavLinks items={items} onNavigate={() => setOpen(false)} />
            <div className="my-1 border-t border-line" />
            <div className="flex items-center gap-2 px-2 py-1">
              <Avatar name={displayName} size="sm" />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {displayName}
              </span>
            </div>
            <form action={logoutAction} onSubmit={() => setOpen(false)}>
              <button
                type="submit"
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-muted hover:bg-faint hover:text-ink"
              >
                <Icon name="logout" />
                {logoutLabel}
              </button>
            </form>
          </div>
        </>
      ) : null}
    </div>
  );
}
