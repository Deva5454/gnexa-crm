"use client";

import { useRef, useState } from "react";
import { ChevronDown, ChevronUp, Eye, EyeOff, LayoutGrid, X } from "lucide-react";
import { resetDashboard, saveDashboard } from "@/app/(app)/dashboard/actions";
import { SubmitButton } from "@/components/ui/submit-button";
import { cn } from "@/lib/utils";

/** Perfex "Dashboard options": show/hide widgets and change their order, saved per person. */
export function DashboardOptions({ widgets }: { widgets: { key: string; label: string; hidden: boolean }[] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [order, setOrder] = useState(() => widgets.map((w) => w.key));
  const [hidden, setHidden] = useState(() => widgets.filter((w) => w.hidden).map((w) => w.key));
  const labels = Object.fromEntries(widgets.map((w) => [w.key, w.label]));

  const move = (i: number, by: -1 | 1) =>
    setOrder((o) => {
      const j = i + by;
      if (j < 0 || j >= o.length) return o;
      const next = [...o];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });
  const toggle = (k: string) => setHidden((h) => (h.includes(k) ? h.filter((x) => x !== k) : [...h, k]));
  const close = () => dialog.current?.close();

  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-sm font-medium backdrop-blur hover:bg-white/20"
      >
        <LayoutGrid className="h-4 w-4" aria-hidden /> Dashboard options
      </button>
      <dialog
        ref={dialog}
        aria-labelledby="dash-options-title"
        className="w-[min(32rem,calc(100vw-2rem))] rounded-2xl p-0 text-slate-800 shadow-pop backdrop:bg-ink-900/40"
        onClick={(e) => e.target === dialog.current && close()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 id="dash-options-title" className="text-sm font-semibold text-slate-900">Dashboard options</h2>
            <p className="text-xs text-slate-500">Choose the widgets you see and their order. Only you see this layout.</p>
          </div>
          <button type="button" onClick={close} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <ul className="max-h-[60vh] divide-y divide-slate-100 overflow-y-auto">
          {order.map((k, i) => {
            const off = hidden.includes(k);
            return (
              <li key={k} className={cn("flex items-center gap-2 px-5 py-2 text-sm", off && "bg-slate-50 text-slate-400")}>
                <span className="flex-1 truncate">{labels[k]}</span>
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30" aria-label={`Move ${labels[k]} up`}>
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === order.length - 1} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30" aria-label={`Move ${labels[k]} down`}>
                  <ChevronDown className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => toggle(k)} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label={off ? `Show ${labels[k]}` : `Hide ${labels[k]}`} aria-pressed={off}>
                  {off ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 px-5 py-4">
          <form action={saveDashboard} onSubmit={() => setTimeout(close, 0)}>
            <input type="hidden" name="layout" value={JSON.stringify({ order, hidden })} />
            <SubmitButton pendingText="Saving…">Save layout</SubmitButton>
          </form>
          <form action={resetDashboard} onSubmit={() => setTimeout(close, 0)}>
            <SubmitButton variant="secondary" pendingText="Resetting…">Reset to default</SubmitButton>
          </form>
        </div>
      </dialog>
    </>
  );
}
