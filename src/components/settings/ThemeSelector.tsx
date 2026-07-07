"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { updateTheme } from "@/actions/settings";
import { cardClass } from "@/components/ui/classes";
import {
  THEMES,
  THEME_SWATCHES,
  type ThemeChoice,
} from "@/lib/themes";

function Swatch({
  surface,
  panel,
  accent,
  ink,
}: Readonly<{ surface: string; panel: string; accent: string; ink: string }>) {
  return (
    <span
      className="flex h-10 w-14 shrink-0 items-center gap-1 rounded-md border border-line p-1"
      style={{ backgroundColor: surface }}
    >
      <span
        className="flex h-full flex-1 items-center justify-center rounded-sm text-[10px] font-bold"
        style={{ backgroundColor: panel, color: ink }}
      >
        Aa
      </span>
      <span
        className="h-full w-3 rounded-sm"
        style={{ backgroundColor: accent }}
      />
    </span>
  );
}

function Option({
  active,
  onClick,
  label,
  children,
}: Readonly<{
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}>) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center gap-2 rounded-lg border p-2 text-left text-sm transition ${
        active
          ? "border-accent ring-2 ring-accent"
          : "border-line hover:bg-faint"
      }`}
    >
      {children}
      <span className="truncate">{label}</span>
    </button>
  );
}

export function ThemeSelector({
  current,
}: Readonly<{ current: ThemeChoice }>) {
  const t = useTranslations("appearance");
  const [selected, setSelected] = useState<ThemeChoice>(current);
  const [, startTransition] = useTransition();

  function choose(choice: ThemeChoice) {
    setSelected(choice);
    startTransition(() => updateTheme(choice));
  }

  const light = THEMES.filter((theme) => theme.kind === "light");
  const dark = THEMES.filter((theme) => theme.kind === "dark");

  return (
    <div className={`${cardClass} flex flex-col gap-4`}>
      <h2 className="text-lg font-medium">{t("title")}</h2>

      <Option
        active={selected === "auto"}
        onClick={() => choose("auto")}
        label={t("auto")}
      >
        <span className="flex h-10 w-14 shrink-0 overflow-hidden rounded-md border border-line">
          <span className="h-full w-1/2" style={{ backgroundColor: "#fafaf9" }} />
          <span className="h-full w-1/2" style={{ backgroundColor: "#1e1e2e" }} />
        </span>
      </Option>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-subtle">
          {t("light")}
        </span>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {light.map((theme) => (
            <Option
              key={theme.id}
              active={selected === theme.id}
              onClick={() => choose(theme.id)}
              label={t(`themes.${theme.id}`)}
            >
              <Swatch {...THEME_SWATCHES[theme.id]} />
            </Option>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-subtle">
          {t("dark")}
        </span>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {dark.map((theme) => (
            <Option
              key={theme.id}
              active={selected === theme.id}
              onClick={() => choose(theme.id)}
              label={t(`themes.${theme.id}`)}
            >
              <Swatch {...THEME_SWATCHES[theme.id]} />
            </Option>
          ))}
        </div>
      </div>
    </div>
  );
}
