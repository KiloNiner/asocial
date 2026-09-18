"use client";

import { useTransition, type ReactNode } from "react";
import { dismissPrompt } from "@/actions/prompts";
import type { PromptKey } from "@/lib/prompts";

/**
 * A dashboard prompt with a way out.
 *
 * Deliberately styled as a calm panel rather than a warning: nothing asocial
 * raises here is the reader's fault, and the guilt-free rule that keeps the
 * board free of red states applies just as much to a prompt about the board.
 * The dismiss affordance is not optional — a prompt that can only be answered
 * is a nag.
 */
export function Nudge({
  promptKey,
  title,
  body,
  dismissLabel,
  children,
}: Readonly<{
  promptKey: PromptKey;
  title: string;
  body: string;
  dismissLabel: string;
  /** The call to action — a link, or a form posting a server action. */
  children: ReactNode;
}>) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-accent/40 bg-accent-soft/30 p-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="text-sm text-muted">{body}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {children}
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await dismissPrompt(promptKey);
            })
          }
          className="text-sm text-muted underline-offset-2 hover:underline disabled:opacity-50"
        >
          {dismissLabel}
        </button>
      </div>
    </div>
  );
}
