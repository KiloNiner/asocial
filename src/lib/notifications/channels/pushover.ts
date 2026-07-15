import type { NotificationChannel } from "../channel";
import { pushoverConfigSchema } from "../channel";
import { digestTranslator, escapeHtml, type DigestT } from "../messages";
import type { DigestItem } from "../digest";

const API_URL =
  process.env.PUSHOVER_API_URL ?? "https://api.pushover.net/1/messages.json";

// Pushover renders a restricted HTML subset (b/i/u/a/font) when html: 1 is
// set; https://pushover.net/api#html. Bolding the suggestion and dimming
// the "tomorrow" tag gives it the same visual hierarchy as the digest email
// without needing Pushover's separate (icon-based) branding.
function pushoverLine(item: DigestItem, t: DigestT): string {
  const sentence = escapeHtml(
    t(item.kind === "birthday" ? "digest.lineBirthday" : "digest.line", {
      name: item.friendName,
      type: item.typeLabel,
    }),
  );
  const line = `${item.typeEmoji} <b>${sentence}</b>`;
  return item.status === "tomorrow"
    ? `${line} <font color="#999999">— ${escapeHtml(t("digest.tomorrow"))}</font>`
    : line;
}

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
        message: digest.items.map((item) => pushoverLine(item, t)).join("\n"),
        html: 1,
        url: process.env.APP_URL ?? "",
        url_title: t("digest.openApp"),
      }),
    });
    if (!response.ok) {
      throw new Error(`pushover ${response.status}: ${await response.text()}`);
    }
  },
};
