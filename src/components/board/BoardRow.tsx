"use client";

import { useState } from "react";
import { TaskCard, type TypeInfo } from "@/components/tasks/TaskCard";
import type { Task } from "@/db/schema";
import { Link } from "@/i18n/navigation";

export type BandSpec = {
  task: Task;
  /** 1-based grid column of the window start/end (already clamped). */
  startCol: number;
  endCol: number;
  state: "upcoming" | "open" | "stillOpen";
  /** True when the real window starts before the visible range. */
  clippedStart: boolean;
};

const stateBand = {
  upcoming: "opacity-45",
  open: "opacity-100",
  stillOpen: "opacity-80 saturate-50",
};

export function BoardRow({
  friendId,
  friendName,
  color,
  emoji,
  band,
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
  birthdayCol: number | null;
  birthdayTask: Task | null;
  types: TypeInfo[];
  today: string;
  columns: number;
}>) {
  const [expanded, setExpanded] = useState<"contact" | "birthday" | null>(null);

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
            className={`h-5 cursor-pointer ${
              band.clippedStart ? "rounded-r-full" : "rounded-full"
            } ${stateBand[band.state]}`}
            style={{
              gridColumn: `${band.startCol} / ${band.endCol + 1}`,
              backgroundColor: color,
            }}
          />
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

      {expanded === "contact" && band ? (
        <div className="max-w-xl py-2">
          <TaskCard
            key={band.task.id}
            task={band.task}
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
