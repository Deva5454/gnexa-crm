"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { cn, formatDate, formatMoney } from "@/lib/utils";
import { moveDocStatus } from "../actions";

export type PipelineCard = {
  id: number;
  href: string;
  label: string;
  party: string;
  total: number;
  currency: string;
  date: string;
  due: string | null;
  status: string; // stored status: draft | sent | accepted | declined | cancelled
  expired: boolean;
  agent: string | null;
  invoiced: { href: string; label: string } | null;
};

// Perfex's estimate pipeline. "Expired" is worked out from the date, so it shows but can't be dropped onto.
const COLUMNS = [
  { key: "draft", label: "Draft", color: "#94a3b8" },
  { key: "sent", label: "Sent", color: "#0ea5e9" },
  { key: "expired", label: "Expired", color: "#f59e0b" },
  { key: "declined", label: "Declined", color: "#e11d48" },
  { key: "accepted", label: "Accepted", color: "#10b981" },
] as const;
const column = (c: PipelineCard) => (c.status === "sent" && c.expired ? "expired" : c.status);

export function DocPipeline({ cards, canEdit, base }: { cards: PipelineCard[]; canEdit: boolean; base: string }) {
  const [, start] = useTransition();
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [items, move] = useOptimistic(cards, (state: PipelineCard[], m: { id: number; status: string }) =>
    state.map((c) => (c.id === m.id ? { ...c, status: m.status, expired: m.status === "sent" ? c.expired : false } : c)),
  );

  const drop = (status: string, id: number | null = dragging) => {
    setDragging(null);
    setOver(null);
    if (id == null || !canEdit || status === "expired") return;
    const card = items.find((c) => c.id === id);
    if (!card || card.status === status) return;
    start(async () => {
      move({ id, status });
      const res = await moveDocStatus(id, status);
      setError(res?.error ?? null);
    });
  };

  return (
    <>
      {error && <div className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">{error}</div>}
      <div className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0">
        {COLUMNS.map((col) => {
          const list = items.filter((c) => column(c) === col.key);
          const droppable = canEdit && col.key !== "expired";
          return (
            <section
              key={col.key}
              aria-label={col.label}
              onDragOver={(e) => {
                if (!droppable || dragging == null) return;
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
                  <h3 className="text-sm font-semibold text-slate-800">{col.label}</h3>
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
                    className={cn(
                      "relative rounded-xl border border-slate-200/80 bg-white p-3 shadow-card transition hover:border-brand-200",
                      canEdit && "cursor-grab active:cursor-grabbing",
                      dragging === c.id && "opacity-40",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <Link href={c.href} className="font-mono text-sm font-semibold text-brand-700 hover:underline">{c.label}</Link>
                      {c.invoiced && (
                        <Link href={c.invoiced.href} className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200 hover:underline">
                          Invoiced
                        </Link>
                      )}
                    </div>
                    <div className="mt-0.5 truncate text-sm text-slate-700">{c.party}</div>
                    <div className="mt-2 text-sm font-semibold text-slate-900">{formatMoney(c.total, c.currency)}</div>
                    <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 text-[11px] text-slate-400">
                      <span>{formatDate(c.date)}</span>
                      {c.due && <span className={c.expired && c.status === "sent" ? "font-semibold text-amber-600" : ""}>valid till {formatDate(c.due)}</span>}
                    </div>
                    {c.agent && <div className="mt-1 truncate text-[11px] text-slate-400">{c.agent}</div>}
                    {canEdit && (
                      // Keyboard and screen-reader alternative to dragging: appears when focused
                      <select
                        aria-label={`Move ${c.label} to`}
                        value={c.status}
                        onChange={(e) => drop(e.target.value, c.id)}
                        className="sr-only mt-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700 focus:not-sr-only focus:w-full focus:outline-none focus:ring-2 focus:ring-brand-200"
                      >
                        {COLUMNS.filter((o) => o.key !== "expired").map((o) => <option key={o.key} value={o.key}>Move to: {o.label}</option>)}
                      </select>
                    )}
                  </article>
                ))}
                {!list.length && (
                  <div className="flex flex-1 items-center justify-center rounded-xl border-2 border-dashed border-slate-200 text-xs text-slate-400">
                    {droppable ? "Drop here" : "None"}
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
      <p className="text-xs text-slate-400">Drag a card to change its status. {base.includes("estimates") ? "Accepted estimates can then be converted to invoices." : ""}</p>
    </>
  );
}
