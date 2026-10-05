"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  disableCalendarFeed,
  rotateCalendarFeed,
} from "@/actions/calendar-feed";
import {
  buttonClass,
  buttonGhostClass,
  cardClass,
  inputClass,
} from "@/components/ui/classes";

export function CalendarFeedCard({ url }: Readonly<{ url: string | null }>) {
  const t = useTranslations("calendar.feed");
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  const run = (action: () => Promise<void>, warning?: string) => {
    if (warning && !confirm(warning)) return;
    setCopied(false);
    startTransition(() => action());
  };

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // Clipboard API needs a secure context; the field is still selectable.
    }
  };

  return (
    <div className={`${cardClass} flex flex-col gap-3`}>
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-medium">{t("title")}</h2>
        <p className="text-sm text-muted">{t("intro")}</p>
      </div>

      {url ? (
        <>
          <div className="flex flex-wrap gap-2">
            <input
              readOnly
              value={url}
              aria-label={t("urlLabel")}
              onFocus={(e) => e.currentTarget.select()}
              className={`${inputClass} min-w-0 flex-1 font-mono text-sm`}
            />
            <button type="button" onClick={copy} className={buttonClass}>
              {copied ? t("copied") : t("copy")}
            </button>
          </div>
          <p className="text-sm text-muted">{t("privateNote")}</p>
          <div className="flex flex-wrap gap-2">
            <a
              href={url.replace(/^https?:/, "webcal:")}
              className={buttonGhostClass}
            >
              {t("openApp")}
            </a>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(rotateCalendarFeed, t("regenerateConfirm"))}
              className={buttonGhostClass}
            >
              {t("regenerate")}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(disableCalendarFeed, t("disableConfirm"))}
              className={buttonGhostClass}
            >
              {t("disable")}
            </button>
          </div>
        </>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(rotateCalendarFeed)}
          className={`${buttonClass} self-start`}
        >
          {t("enable")}
        </button>
      )}
    </div>
  );
}
