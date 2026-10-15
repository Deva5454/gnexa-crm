"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { Building2, Clock } from "lucide-react";
import { TagChip, type TagLite } from "@/components/crm/tag-editor";
import { Avatar } from "@/components/ui/avatar";
import { cn, formatMoney, timeAgo } from "@/lib/utils";
import { moveLead } from "./actions";

export type KanbanLead = {
  id: number;
  name: string;
  company: string | null;
  value: number | null;
  status_id: number | null;
  position: number;
  created_at: string;
  last_contact_at: string | null;
  source: string | null;
  assignee: string | null;
  tags?: TagLite[];
};
export type KanbanStatus = { id: number; name: string; color: string };

type Move = { id: number; statusId: number; position: number };

export function LeadsKanban({
  statuses,
  leads,
  currency,
  canEdit,
}: {
  statuses: KanbanStatus[];
  leads: KanbanLead[];
  currency: string;
  canEdit: boolean;
}) {
  const [, startTransition] = useTransition();
  const [dragging, setDragging] = useState<number | null>(null);
  const [overCol, setOverCol] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [optimistic, applyMove] = useOptimistic(leads, (state: KanbanLead[], m: Move) =>
    state.map((l) => (l.id === m.id ? { ...l, status_id: m.statusId, position: m.position } : l)),
  );

  const columns = statuses.map((s) => ({
    ...s,
    items: optimistic.filter((l) => l.status_id === s.id).sort((a, b) => a.position - b.position),
  }));

  const drop = (statusId: number, beforeId: number | null) => {
    const id = dragging;
    setDragging(null);
    setOverCol(null);
    if (id == null || !canEdit) return;
    const col = columns.find((c) => c.id === statusId)!.items.filter((l) => l.id !== id);
    const idx = beforeId == null ? col.length : col.findIndex((l) => l.id === beforeId);
    const prev = col[idx - 1]?.position;
    const next = col[idx]?.position;
    const position =
      prev == null && next == null ? 1 : prev == null ? next! - 1 : next == null ? prev + 1 : (prev + next) / 2;
    startTransition(async () => {
      applyMove({ id, statusId, position });
      const res = await moveLead(id, statusId, position);
      setError(res?.error ?? null);
    });
  };

  return (
    <>
      {error && <div className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}
      {!canEdit && (
        <div className="mb-3 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800">
          View-only: your role can&apos;t move leads between stages.
        </div>
      )}
      <div className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0">
        {columns.map((col) => {
          const total = col.items.reduce((s, l) => s + (l.value ?? 0), 0);
          return (
            <section
              key={col.id}
              onDragOver={(e) => {
                if (!canEdit || dragging == null) return;
                e.preventDefault();
                setOverCol(col.id);
              }}
              onDragLeave={() => setOverCol((c) => (c === col.id ? null : c))}
              onDrop={() => drop(col.id, null)}
              className={cn(
                "flex w-72 shrink-0 snap-start flex-col rounded-2xl bg-slate-100/70 transition-colors",
                overCol === col.id && "bg-brand-50 ring-2 ring-brand-200",
              )}
            >
              <header className="px-3 pb-2 pt-3">
                <div className="h-1 rounded-full" style={{ backgroundColor: col.color }} />
                <div className="mt-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-800">{col.name}</h3>
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-500">{col.items.length}</span>
                </div>
                <div className="mt-0.5 text-xs text-slate-500">{formatMoney(total, currency)}</div>
              </header>
              <div className="flex min-h-[120px] flex-1 flex-col gap-2 px-2 pb-3">
                {col.items.map((l) => (
                  <article
                    key={l.id}
                    draggable={canEdit}
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = "move";
                      setDragging(l.id);
                    }}
                    onDragEnd={() => setDragging(null)}
                    onDrop={(e) => {
                      e.stopPropagation();
                      drop(col.id, l.id);
                    }}
                    className={cn(
                      "rounded-xl border border-slate-200/80 bg-white p-3 shadow-card transition hover:border-brand-200 hover:shadow-md",
                      canEdit && "cursor-grab active:cursor-grabbing",
                      dragging === l.id && "opacity-40",
                    )}
                  >
                    {(l.tags?.length ?? 0) > 0 && <div className="mb-1.5 flex flex-wrap gap-1">{l.tags!.map((g) => <TagChip key={g.id} tag={g} className="px-1.5 text-[10px]" />)}</div>}
                    <Link href={`/leads/${l.id}`} className="block text-sm font-semibold text-slate-900 hover:text-brand-700">
                      {l.name}
                    </Link>
                    {l.company && (
                      <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                        <Building2 className="h-3 w-3" /> {l.company}
                      </div>
                    )}
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-800">{l.value != null ? formatMoney(l.value, currency) : ""}</span>
                      {l.assignee && <Avatar name={l.assignee} className="h-6 w-6 text-[10px]" />}
                    </div>
                    <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 text-[11px] text-slate-400">
                      <span>{l.source ?? "No source"}</span>
                      <span className="flex items-center gap-1" suppressHydrationWarning>
                        <Clock className="h-3 w-3" />
                        {timeAgo(l.last_contact_at ?? l.created_at)}
                      </span>
                    </div>
                  </article>
                ))}
                {!col.items.length && (
                  <div className="flex flex-1 items-center justify-center rounded-xl border-2 border-dashed border-slate-200 text-xs text-slate-400">
                    Drop leads here
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
