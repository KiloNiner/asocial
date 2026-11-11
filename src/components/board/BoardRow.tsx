"use client";

import { useState } from "react";
import { TaskCard, type TypeInfo } from "@/components/tasks/TaskCard";
import type { Task } from "@/db/schema";
import { Link } from "@/i18n/navigation";

export type BandSpec = {
  task: Task;
  /** 1-based grid column of the (clamped) window start/end. */
  startCol: number;
  endCol: number;
  state: "upcoming" | "open" | "stillOpen";
  /** The real window starts before the visible range (flat left edge). */
  clippedStart: boolean;
  /** The real window extends past the visible range (flat right edge). */
  clippedEnd: boolean;
};

/** A window that lies entirely outside the board — shown as a date marker. */
export type BeyondSpec = {
  task: Task;
  label: string;
  future: boolean;
};

/**
 * A pending birthday. `clampedLabel` is set when the real date lies outside
 * the visible range and the marker is pinned to the nearest edge instead —
 * the row is still sorted by that date, so it has to be visible somewhere.
 */
export type BirthdaySpec = {
  task: Task;
  col: number;
  clampedLabel: string | null;
};

const stateBand = {
  upcoming: "opacity-45",
  open: "opacity-100",
  stillOpen: "opacity-80 saturate-50",
};

function bandRounding(band: BandSpec): string {
  if (band.clippedStart && band.clippedEnd) return "";
  if (band.clippedStart) return "rounded-r-full";
  if (band.clippedEnd) return "rounded-l-full";
  return "rounded-full";
}

export function BoardRow({
  friendId,
  friendName,
  color,
  emoji,
  band,
  beyond,
  birthday,
  types,
  today,
  columns,
  grid,
}: Readonly<{
  friendId: string;
  friendName: string;
  color: string;
  emoji: string;
  band: BandSpec | null;
  beyond: BeyondSpec | null;
  birthday: BirthdaySpec | null;
  types: TypeInfo[];
  today: string;
  columns: number;
  /** grid-template-columns shared with the board header. */
  grid: string;
}>) {
  const [expanded, setExpanded] = useState<"contact" | "birthday" | null>(null);
  const contactTask = band?.task ?? beyond?.task ?? null;

  return (
    <div className="border-b border-line last:border-b-0">
      <div className="grid items-center" style={{ gridTemplateColumns: grid }}>
        <Link
          href={`/friends/${friendId}`}
          className="group sticky left-0 z-10 flex items-center gap-2 bg-panel py-2 pr-2 text-sm font-semibold"
          style={{ gridColumn: "1", gridRow: "1" }}
        >
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: color }}
          />
          <span className="truncate underline-offset-2 group-hover:underline">
            {friendName}
          </span>
          <span className="text-xs">{emoji}</span>
        </Link>

        {band ? (
          <button
            type="button"
            onClick={() =>
              setExpanded(expanded === "contact" ? null : "contact")
            }
            aria-expanded={expanded === "contact"}
            aria-label={friendName}
            title={friendName}
            className={`h-6 transition hover:brightness-95 ${bandRounding(band)} ${
              stateBand[band.state]
            } ${expanded === "contact" ? "ring-2 ring-sel/40 ring-offset-1 ring-offset-panel" : ""}`}
            style={{
              gridColumn: `${band.startCol} / ${band.endCol + 1}`,
              gridRow: "1",
              backgroundColor: color,
            }}
          />
        ) : null}

        {beyond ? (
          <button
            type="button"
            onClick={() =>
              setExpanded(expanded === "contact" ? null : "contact")
            }
            aria-expanded={expanded === "contact"}
            title={friendName}
            className={`flex items-center gap-1.5 truncate py-1 text-xs font-medium text-muted hover:text-ink ${
              beyond.future ? "justify-end pr-1" : "justify-start pl-1"
            }`}
            style={{
              gridRow: "1",
              gridColumn: beyond.future
                ? `${Math.max(2, columns - 5)} / ${columns + 2}`
                : `2 / 8`,
            }}
          >
            <span
              className="inline-block h-2 w-2 shrink-0 rounded-full opacity-60"
              style={{ backgroundColor: color }}
            />
            {beyond.future ? `→ ${beyond.label}` : `${beyond.label} ←`}
          </button>
        ) : null}

        {birthday ? (
          <button
            type="button"
            onClick={() =>
              setExpanded(expanded === "birthday" ? null : "birthday")
            }
            aria-expanded={expanded === "birthday"}
            aria-label={`🎂 ${friendName}`}
            title={birthday.clampedLabel ?? undefined}
            className={`z-[1] text-center text-sm leading-6 transition hover:scale-125 ${
              birthday.clampedLabel ? "opacity-50" : ""
            }`}
            style={{ gridColumn: `${birthday.col}`, gridRow: "1" }}
          >
            🎂
          </button>
        ) : null}
      </div>

      {expanded === "contact" && contactTask ? (
        <div className="max-w-xl pb-3 pt-1">
          <TaskCard
            key={contactTask.id}
            task={contactTask}
            types={types.filter((type) => type.id !== "congratulate")}
            today={today}
          />
        </div>
      ) : null}
      {expanded === "birthday" && birthday ? (
        <div className="max-w-xl pb-3 pt-1">
          <TaskCard
            key={birthday.task.id}
            task={birthday.task}
            types={types}
            today={today}
          />
        </div>
      ) : null}
    </div>
  );
}
