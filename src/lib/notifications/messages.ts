import { createTranslator } from "next-intl";
import en from "../../../messages/en.json";
import da from "../../../messages/da.json";
import sv from "../../../messages/sv.json";
import tlh from "../../../messages/tlh.json";
import type { UserSettings } from "@/db/schema";
import type { Digest } from "./digest";

const messagesByLocale = { en, da, sv, tlh } as const;

/** Translator usable outside a request scope (cron-driven sends). */
export function digestTranslator(locale: UserSettings["locale"]) {
  return createTranslator({
    locale,
    messages: messagesByLocale[locale] ?? en,
  });
}

export type DigestT = ReturnType<typeof digestTranslator>;

export function digestLines(digest: Digest, t: DigestT): string[] {
  return digest.items.map((item) => {
    const line = `${item.typeEmoji} ${t(
      item.kind === "birthday" ? "digest.lineBirthday" : "digest.line",
      { name: item.friendName, type: item.typeLabel },
    )}`;
    return item.status === "tomorrow"
      ? `${line} — ${t("digest.tomorrow")}`
      : line;
  });
}
