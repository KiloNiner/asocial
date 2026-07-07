import type { NotificationChannel } from "../channel";
import { pushoverConfigSchema } from "../channel";
import { digestLines, digestTranslator } from "../messages";

const API_URL =
  process.env.PUSHOVER_API_URL ?? "https://api.pushover.net/1/messages.json";

export const pushoverChannel: NotificationChannel = {
  id: "pushover",
  configSchema: pushoverConfigSchema,

  async send(user, settings, digest, config) {
    const { token, userKey } = pushoverConfigSchema.parse(config);
    const t = digestTranslator(settings.locale);

    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        user: userKey,
        title: t("digest.title", { n: digest.items.length }),
        message: digestLines(digest, t).join("\n"),
        url: process.env.APP_URL ?? "",
        url_title: t("digest.openApp"),
      }),
    });
    if (!response.ok) {
      throw new Error(`pushover ${response.status}: ${await response.text()}`);
    }
  },
};
