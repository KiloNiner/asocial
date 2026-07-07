import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "da", "sv", "tlh"],
  defaultLocale: "en",
});

export type Locale = (typeof routing.locales)[number];
