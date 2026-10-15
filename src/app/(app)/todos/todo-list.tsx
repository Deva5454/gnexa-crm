"use client";

import { useOptimistic, useRef, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { addTodo, deleteTodo, toggleTodo } from "@/lib/actions/todos";
import { cn } from "@/lib/utils";

export type Todo = { id: number; body: string; is_done: boolean };

type Op = { type: "toggle"; id: number } | { type: "delete"; id: number } | { type: "add"; body: string };

export function TodoList({ todos, compact = false }: { todos: Todo[]; compact?: boolean }) {
  const [, start] = useTransition();
  const form = useRef<HTMLFormElement>(null);
  const [list, apply] = useOptimistic(todos, (state: Todo[], op: Op) =>
    op.type === "toggle"
      ? state.map((t) => (t.id === op.id ? { ...t, is_done: !t.is_done } : t))
      : op.type === "delete"
        ? state.filter((t) => t.id !== op.id)
        : [...state, { id: -Date.now(), body: op.body, is_done: false }],
  );
  const open = list.filter((t) => !t.is_done);
  const done = list.filter((t) => t.is_done);
  const shown = compact ? [...open.slice(0, 6), ...(open.length < 6 ? done.slice(0, 6 - open.length) : [])] : [...open, ...done];

  return (
    <div className="space-y-3">
      <form
        ref={form}
        action={async (fd) => {
          const body = String(fd.get("body") ?? "").trim();
          if (!body) return;
          form.current?.reset();
          apply({ type: "add", body });
          await addTodo(fd);
        }}
        className="flex gap-2"
      >
        <input name="body" required maxLength={300} placeholder="Add a to-do…" className="field" aria-label="New to-do" />
        <button className="inline-flex h-9 shrink-0 items-center gap-1 rounded-lg bg-brand-600 px-3 text-sm font-semibold text-white hover:bg-brand-700">
          <Plus className="h-4 w-4" /> Add
        </button>
      </form>
      <ul className="space-y-0.5">
        {shown.map((t) => (
          <li key={t.id} className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-slate-50">
            <input
              type="checkbox"
              checked={t.is_done}
              disabled={t.id < 0}
              onChange={() => start(async () => { apply({ type: "toggle", id: t.id }); await toggleTodo(t.id, !t.is_done); })}
              aria-label={t.body}
              className="h-4 w-4 cursor-pointer rounded border-slate-300 text-accent-500 focus:ring-accent-400"
            />
            <span className={cn("flex-1 text-sm text-slate-700", t.is_done && "text-slate-400 line-through")}>{t.body}</span>
            {t.id > 0 && (
              <button
                type="button"
                onClick={() => start(async () => { apply({ type: "delete", id: t.id }); await deleteTodo(t.id); })}
                className="rounded p-0.5 text-slate-300 opacity-0 hover:text-rose-600 group-hover:opacity-100 focus:opacity-100"
                aria-label={`Delete ${t.body}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </li>
        ))}
        {!list.length && <li className="px-2 py-3 text-sm text-slate-400">Nothing on your list.</li>}
      </ul>
    </div>
  );
}
