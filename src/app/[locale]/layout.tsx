import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { getCurrentUser, getSettings } from "@/lib/auth/current-user";
import { THEME_COOKIE, isThemeChoice, type ThemeChoice } from "@/lib/themes";
import "../globals.css";

/**
 * Resolve the active theme without a flash: the logged-in user's setting
 * wins, else the theme cookie (so login pages match), else auto.
 */
async function resolveTheme(): Promise<ThemeChoice> {
  const user = await getCurrentUser();
  if (user) {
    const settings = await getSettings(user.id);
    if (isThemeChoice(settings.theme)) return settings.theme;
  }
  const cookieValue = (await cookies()).get(THEME_COOKIE)?.value;
  if (cookieValue && isThemeChoice(cookieValue)) return cookieValue;
  return "auto";
}

export const metadata: Metadata = {
  title: "asocial",
  description: "Gentle training wheels for keeping your friendships alive",
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/mark.svg", type: "image/svg+xml" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    title: "asocial",
    statusBarStyle: "default",
  },
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);
  const theme = await resolveTheme();

  return (
    <html
      lang={locale}
      className="h-full antialiased"
      // Auto stamps no attribute so the prefers-color-scheme media query decides.
      data-theme={theme === "auto" ? undefined : theme}
    >
      <body className="min-h-full flex flex-col bg-surface text-ink">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
