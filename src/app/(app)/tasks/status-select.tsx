"use client";

import { useTransition } from "react";
import { CheckCircle2, ChevronDown, Circle } from "lucide-react";
import { TASK_STATUSES, taskStatus } from "@/lib/constants";
import type { Enums } from "@/lib/database.types";
import { cn } from "@/lib/utils";
import { setTaskStatus } from "./actions";

export function StatusSelect({ id, status }: { id: number; status: Enums<"task_status"> }) {
  const [pending, start] = useTransition();
  const s = taskStatus(status);
  return (
    <span className="relative inline-flex items-center">
      <select
        aria-label="Task status"
        value={status}
        disabled={pending}
        onChange={(e) => start(() => setTaskStatus(id, e.target.value as Enums<"task_status">))}
        className={cn(
          "cursor-pointer appearance-none rounded-full border-0 py-0.5 pl-2.5 pr-6 text-xs font-medium ring-1 ring-inset focus:ring-2 focus:ring-brand-300",
          s.color,
          pending && "opacity-50",
        )}
      >
        {TASK_STATUSES.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-1.5 h-3 w-3 opacity-60" />
    </span>
  );
}

export function CompleteToggle({ id, done }: { id: number; done: boolean }) {
  const [pending, start] = useTransition();
  // A round tick, so it reads differently from the square "select" boxes next to it
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={done ? "Mark as not started" : "Mark complete"}
      disabled={pending}
      onClick={() => start(() => setTaskStatus(id, done ? "not_started" : "complete"))}
      className={cn("rounded-full p-0.5 transition disabled:opacity-50", done ? "text-accent-500 hover:text-slate-400" : "text-slate-300 hover:text-accent-500")}
    >
      {done ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
    </button>
  );
}
