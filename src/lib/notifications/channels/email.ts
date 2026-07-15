import { readFileSync } from "node:fs";
import { join } from "node:path";
import nodemailer, { type Transporter } from "nodemailer";
import type { NotificationChannel } from "../channel";
import { emailConfigSchema } from "../channel";
import { digestLines, digestTranslator, escapeHtml, type DigestT } from "../messages";
import type { Digest, DigestItem } from "../digest";

const LOGO_CID = "asocial-mark";
const logoBuffer = readFileSync(join(process.cwd(), "public", "mark-email.png"));

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
    // Local relays (e.g. a Proton Mail Bridge or Mailhog container) commonly
    // present a self-signed cert; this keeps STARTTLS encryption on while
    // skipping the certificate check for that case.
    tls:
      process.env.SMTP_TLS_REJECT_UNAUTHORIZED === "false"
        ? { rejectUnauthorized: false }
        : undefined,
  });
  return transporter;
}

function itemRow(item: DigestItem, t: DigestT): string {
  const sentence = escapeHtml(
    t(item.kind === "birthday" ? "digest.lineBirthday" : "digest.line", {
      name: item.friendName,
      type: item.typeLabel,
    }),
  );
  const badge =
    item.status === "tomorrow"
      ? `<td style="padding-left:8px; vertical-align:middle;" align="right">
           <span class="pill" style="display:inline-block; font-size:11px; font-weight:600; color:#78716c; background-color:#f5f5f4; padding:3px 9px; border-radius:999px; white-space:nowrap;">${escapeHtml(t("digest.tomorrow"))}</span>
         </td>`
      : "";

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0;">
      <tr>
        <td class="badge" width="36" height="36" align="center" valign="middle" style="width:36px; height:36px; border-radius:18px; background-color:#f0fdfa; font-size:16px; line-height:36px;">${escapeHtml(item.typeEmoji)}</td>
        <td style="padding-left:12px; vertical-align:middle;">
          <p class="text-ink" style="margin:0; font-size:14.5px; line-height:1.4; color:#1c1917;">${sentence}</p>
        </td>
        ${badge}
      </tr>
    </table>`;
}

function buildHtml(digest: Digest, t: DigestT, appUrl: string): string {
  const title = escapeHtml(t("digest.title", { n: digest.items.length }));
  const openApp = escapeHtml(t("digest.openApp"));
  const footer = escapeHtml(t("digest.footer"));
  const rows = digest.items.map((item) => itemRow(item, t)).join("\n");

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light dark" />
    <meta name="supported-color-schemes" content="light dark" />
    <title>${title}</title>
    <style>
      @media (prefers-color-scheme: dark) {
        .bg-outer { background-color: #101014 !important; }
        .bg-panel { background-color: #1e1e2e !important; border-color: #313244 !important; }
        .divider { border-color: #313244 !important; }
        .text-ink { color: #cdd6f4 !important; }
        .text-muted { color: #a6adc8 !important; }
        .badge { background-color: #223f3d !important; }
        .pill { background-color: #313244 !important; color: #a6adc8 !important; }
      }
    </style>
  </head>
  <body style="margin:0; padding:0; background-color:#f4f4f5;">
    <span style="display:none; font-size:0; line-height:0; max-height:0; overflow:hidden; opacity:0;">${title}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="bg-outer" style="background-color:#f4f4f5;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="bg-panel" style="max-width:480px; background-color:#ffffff; border:1px solid #e7e5e4; border-radius:16px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
            <tr>
              <td class="divider" style="padding:22px 28px; border-bottom:1px solid #e7e5e4;">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding-right:8px;"><img src="cid:${LOGO_CID}" width="22" height="22" alt="" style="display:block; width:22px; height:22px;" /></td>
                    <td class="text-ink" style="font-size:16px; font-weight:700; color:#1c1917; letter-spacing:-0.01em;">asocial</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 28px 4px;">
                <p class="text-ink" style="margin:0; font-size:19px; font-weight:700; color:#1c1917;">${title}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 22px 4px;">
                ${rows}
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:20px 28px 28px;">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="border-radius:10px; background-color:#0f766e;">
                      <a href="${appUrl}" style="display:inline-block; padding:12px 28px; font-size:15px; font-weight:600; color:#ffffff; text-decoration:none;">${openApp}</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td class="divider" align="center" style="padding:16px 28px 22px; border-top:1px solid #e7e5e4;">
                <p class="text-muted" style="margin:0; font-size:12px; color:#78716c;">${footer}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
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

    await getTransporter().sendMail({
      from: process.env.SMTP_FROM ?? "asocial <noreply@localhost>",
      to,
      subject: t("digest.title", { n: digest.items.length }),
      text: lines.join("\n"),
      html: buildHtml(digest, t, appUrl),
      attachments: [
        {
          filename: "mark.png",
          content: logoBuffer,
          cid: LOGO_CID,
          contentDisposition: "inline",
        },
      ],
    });
  },
};
