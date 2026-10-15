"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { CalendarDays, CheckSquare, MessageSquare } from "lucide-react";
import { TagChip, type TagLite } from "@/components/crm/tag-editor";
import { Avatar } from "@/components/ui/avatar";
import { TASK_STATUSES, taskPriority } from "@/lib/constants";
import type { Enums } from "@/lib/database.types";
import { cn, formatDate } from "@/lib/utils";
import { setTaskStatus } from "./actions";

export type BoardTask = {
  id: number;
  name: string;
  status: Enums<"task_status">;
  priority: string;
  due_date: string | null;
  rel: string | null;
  assignees: string[];
  tags: TagLite[];
  checklist: [number, number];
  comments: number;
};

const BAR: Record<string, string> = {
  not_started: "bg-slate-300",
  in_progress: "bg-sky-500",
  testing: "bg-violet-500",
  awaiting_feedback: "bg-amber-500",
  complete: "bg-accent-500",
};

export function TasksBoard({ tasks, canEdit, today }: { tasks: BoardTask[]; canEdit: boolean; today: string }) {
  const [, start] = useTransition();
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [optimistic, move] = useOptimistic(tasks, (state: BoardTask[], m: { id: number; status: Enums<"task_status"> }) =>
    state.map((t) => (t.id === m.id ? { ...t, status: m.status } : t)),
  );

  const drop = (status: Enums<"task_status">) => {
    const id = dragging;
    setDragging(null);
    setOver(null);
    if (id == null || !canEdit || optimistic.find((t) => t.id === id)?.status === status) return;
    start(async () => {
      move({ id, status });
      await setTaskStatus(id, status);
    });
  };

  return (
    <div className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0">
      {TASK_STATUSES.map((s) => {
        const items = optimistic.filter((t) => t.status === s.value);
        return (
          <section
            key={s.value}
            onDragOver={(e) => {
              if (!canEdit || dragging == null) return;
              e.preventDefault();
              setOver(s.value);
            }}
            onDragLeave={() => setOver((o) => (o === s.value ? null : o))}
            onDrop={() => drop(s.value)}
            className={cn("flex w-72 shrink-0 snap-start flex-col rounded-2xl bg-slate-100/70 transition-colors", over === s.value && "bg-brand-50 ring-2 ring-brand-200")}
          >
            <header className="px-3 pb-2 pt-3">
              <div className={cn("h-1 rounded-full", BAR[s.value])} />
              <div className="mt-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-800">{s.label}</h3>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-500">{items.length}</span>
              </div>
            </header>
            <div className="flex min-h-[120px] flex-1 flex-col gap-2 px-2 pb-3">
              {items.map((t) => {
                const p = taskPriority(t.priority);
                const late = t.status !== "complete" && t.due_date && t.due_date < today;
                return (
                  <article
                    key={t.id}
                    draggable={canEdit}
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = "move";
                      setDragging(t.id);
                    }}
                    onDragEnd={() => setDragging(null)}
                    className={cn(
                      "rounded-xl border border-slate-200/80 bg-white p-3 shadow-card transition hover:border-brand-200 hover:shadow-md",
                      canEdit && "cursor-grab active:cursor-grabbing",
                      dragging === t.id && "opacity-40",
                    )}
                  >
                    {t.tags.length > 0 && (
                      <div className="mb-2 flex flex-wrap gap-1">{t.tags.map((g) => <TagChip key={g.id} tag={g} className="px-1.5 text-[10px]" />)}</div>
                    )}
                    <Link href={`/tasks/${t.id}`} className={cn("block text-sm font-semibold text-slate-900 hover:text-brand-700", t.status === "complete" && "text-slate-400 line-through")}>
                      {t.name}
                    </Link>
                    {t.rel && <div className="mt-0.5 truncate text-xs text-slate-500">{t.rel}</div>}
                    <div className="mt-3 flex items-center gap-3 text-[11px] text-slate-500">
                      <span className={cn("font-semibold", p.color)}>{p.label}</span>
                      {t.due_date && (
                        <span className={cn("inline-flex items-center gap-1", late && "font-semibold text-rose-600")}>
                          <CalendarDays className="h-3 w-3" />{formatDate(t.due_date).replace(/ \d{4}$/, "")}
                        </span>
                      )}
                      {t.checklist[1] > 0 && (
                        <span className={cn("inline-flex items-center gap-1", t.checklist[0] === t.checklist[1] && "text-accent-600")}>
                          <CheckSquare className="h-3 w-3" />{t.checklist[0]}/{t.checklist[1]}
                        </span>
                      )}
                      {t.comments > 0 && <span className="inline-flex items-center gap-1"><MessageSquare className="h-3 w-3" />{t.comments}</span>}
                      <span className="ml-auto flex -space-x-1.5">
                        {t.assignees.slice(0, 3).map((a) => <Avatar key={a} name={a} className="h-6 w-6 text-[9px] ring-2 ring-white" />)}
                      </span>
                    </div>
                  </article>
                );
              })}
              {!items.length && (
                <div className="flex flex-1 items-center justify-center rounded-xl border-2 border-dashed border-slate-200 text-xs text-slate-400">
                  {canEdit ? "Drop tasks here" : "Nothing here"}
                </div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
