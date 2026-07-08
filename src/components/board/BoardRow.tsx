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
  birthdayCol,
  birthdayTask,
  types,
  today,
  columns,
}: Readonly<{
  friendId: string;
  friendName: string;
  color: string;
  emoji: string;
  band: BandSpec | null;
  beyond: BeyondSpec | null;
  birthdayCol: number | null;
  birthdayTask: Task | null;
  types: TypeInfo[];
  today: string;
  columns: number;
}>) {
  const [expanded, setExpanded] = useState<"contact" | "birthday" | null>(null);
  const contactTask = band?.task ?? beyond?.task ?? null;

  return (
    <div className="border-b border-line">
      <div
        className="grid items-center"
        style={{
          gridTemplateColumns: `11rem repeat(${columns}, minmax(24px, 1fr))`,
        }}
      >
        <Link
          href={`/friends/${friendId}`}
          className="sticky left-0 z-10 flex items-center gap-1.5 truncate bg-panel py-1.5 pr-2 text-sm hover:underline"
          style={{ gridColumn: "1" }}
        >
          <span className="truncate">{friendName}</span>
          <span className="text-xs">{emoji}</span>
        </Link>

        {band ? (
          <button
            type="button"
            onClick={() =>
              setExpanded(expanded === "contact" ? null : "contact")
            }
            title={friendName}
            className={`h-5 cursor-pointer ${bandRounding(band)} ${
              stateBand[band.state]
            }`}
            style={{
              gridColumn: `${band.startCol} / ${band.endCol + 1}`,
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
            title={friendName}
            className={`flex items-center gap-1 truncate py-1 text-xs text-muted hover:text-ink ${
              beyond.future ? "justify-end pr-1" : "justify-start pl-1"
            }`}
            style={{
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

        {birthdayCol ? (
          <button
            type="button"
            onClick={() =>
              setExpanded(expanded === "birthday" ? null : "birthday")
            }
            className="text-center text-sm leading-5"
            style={{ gridColumn: `${birthdayCol}` }}
          >
            🎂
          </button>
        ) : null}
      </div>

      {expanded === "contact" && contactTask ? (
        <div className="max-w-xl py-2">
          <TaskCard
            key={contactTask.id}
            task={contactTask}
            types={types.filter((type) => type.id !== "congratulate")}
            today={today}
          />
        </div>
      ) : null}
      {expanded === "birthday" && birthdayTask ? (
        <div className="max-w-xl py-2">
          <TaskCard
            key={birthdayTask.id}
            task={birthdayTask}
            types={types}
            today={today}
          />
        </div>
      ) : null}
    </div>
  );
}
