import nodemailer, { type Transporter } from "nodemailer";
import type { NotificationChannel } from "../channel";
import { emailConfigSchema } from "../channel";
import { digestLines, digestTranslator } from "../messages";

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!process.env.SMTP_HOST) {
    throw new Error("SMTP not configured (SMTP_HOST empty)");
  }
  transporter ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
  return transporter;
}

export const emailChannel: NotificationChannel = {
  id: "email",
  configSchema: emailConfigSchema,

  async send(user, settings, digest, config) {
    const parsed = emailConfigSchema.parse(config ?? {});
    const to = parsed.address || user.email;
    const t = digestTranslator(settings.locale);
    const lines = digestLines(digest, t);
    const appUrl = process.env.APP_URL ?? "http://localhost:3000";

    const html = `
      <div style="font-family: sans-serif; max-width: 480px">
        <h2 style="color: #0f766e">${t("digest.title", { n: digest.items.length })}</h2>
        <ul style="line-height: 1.8; padding-left: 1.2em">
          ${lines.map((line) => `<li>${line}</li>`).join("\n")}
        </ul>
        <p><a href="${appUrl}" style="color: #0f766e">${t("digest.openApp")}</a></p>
      </div>`;

    await getTransporter().sendMail({
      from: process.env.SMTP_FROM ?? "asocial <noreply@localhost>",
      to,
      subject: t("digest.title", { n: digest.items.length }),
      text: lines.join("\n"),
      html,
    });
  },
};
