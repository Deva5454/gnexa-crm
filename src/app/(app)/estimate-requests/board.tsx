"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { cn, timeAgo } from "@/lib/utils";
import { moveRequestStatus } from "./actions";

export type RequestCard = { id: number; name: string; company: string | null; budget: string | null; status: string; created_at: string; assignee: string | null };
type Column = { key: string; name: string; color: string };

/** Perfex's estimate request kanban: one column per status (Setup → Estimate request → Statuses). */
export function RequestBoard({ cards, columns, canEdit }: { cards: RequestCard[]; columns: Column[]; canEdit: boolean }) {
  const [, start] = useTransition();
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [items, move] = useOptimistic(cards, (state: RequestCard[], m: { id: number; status: string }) => state.map((c) => (c.id === m.id ? { ...c, status: m.status } : c)));

  const drop = (status: string, id: number | null = dragging) => {
    setDragging(null);
    setOver(null);
    if (id == null || !canEdit) return;
    const card = items.find((c) => c.id === id);
    if (!card || card.status === status) return;
    start(async () => {
      move({ id, status });
      const res = await moveRequestStatus(id, status);
      setError(res?.error ?? null);
    });
  };

  return (
    <>
      {error && <div className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">{error}</div>}
      <div className="flex snap-x gap-4 overflow-x-auto p-4">
        {columns.map((col) => {
          const list = items.filter((c) => c.status === col.key);
          return (
            <section
              key={col.key}
              aria-label={col.name}
              onDragOver={(e) => {
                if (!canEdit || dragging == null) return;
                e.preventDefault();
                setOver(col.key);
              }}
              onDragLeave={() => setOver((o) => (o === col.key ? null : o))}
              onDrop={() => drop(col.key)}
              className={cn("flex w-72 shrink-0 snap-start flex-col rounded-2xl bg-slate-100/70 transition-colors", over === col.key && "bg-brand-50 ring-2 ring-brand-200")}
            >
              <header className="px-3 pb-2 pt-3">
                <div className="h-1 rounded-full" style={{ backgroundColor: col.color }} />
                <div className="mt-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-800">{col.name}</h3>
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-500">{list.length}</span>
                </div>
              </header>
              <div className="flex min-h-[120px] flex-1 flex-col gap-2 px-2 pb-3">
                {list.map((c) => (
                  <article
                    key={c.id}
                    draggable={canEdit}
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = "move";
                      setDragging(c.id);
                    }}
                    onDragEnd={() => setDragging(null)}
                    className={cn("relative rounded-xl border border-slate-200/80 bg-white p-3 shadow-card transition hover:border-brand-200", canEdit && "cursor-grab active:cursor-grabbing", dragging === c.id && "opacity-40")}
                  >
                    <Link href={`/estimate-requests/${c.id}`} className="block font-semibold text-slate-900 hover:text-brand-700">{c.name}</Link>
                    {c.company && <div className="truncate text-sm text-slate-600">{c.company}</div>}
                    {c.budget && <div className="mt-1.5 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">{c.budget}</div>}
                    <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 text-[11px] text-slate-400">
                      <span suppressHydrationWarning>{timeAgo(c.created_at)}</span>
                      <span className="truncate">{c.assignee ?? "Unassigned"}</span>
                    </div>
                    {canEdit && (
                      // Keyboard and screen-reader alternative to dragging: appears when focused
                      <select
                        aria-label={`Move request from ${c.name} to`}
                        value={c.status}
                        onChange={(e) => drop(e.target.value, c.id)}
                        className="sr-only mt-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700 focus:not-sr-only focus:w-full focus:outline-none focus:ring-2 focus:ring-brand-200"
                      >
                        {columns.map((o) => <option key={o.key} value={o.key}>Move to: {o.name}</option>)}
                      </select>
                    )}
                  </article>
                ))}
                {!list.length && <div className="flex flex-1 items-center justify-center rounded-xl border-2 border-dashed border-slate-200 text-xs text-slate-400">{canEdit ? "Drop here" : "None"}</div>}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
