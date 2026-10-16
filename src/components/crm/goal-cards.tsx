import { Target, Trash2 } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { deleteGoal } from "@/app/(app)/goals/actions";
import type { Tables } from "@/lib/database.types";
import { goalMetric } from "@/lib/goals";
import { cn, formatDate, formatMoney } from "@/lib/utils";
import { todayIST } from "@/lib/dates";

export function GoalCards({
  goals,
  progress,
  staffNames,
  canDelete,
  compact,
}: {
  goals: Tables<"goals">[];
  progress: Map<number, number>;
  staffNames: Map<string, string>;
  canDelete?: boolean;
  compact?: boolean;
}) {
  const today = todayIST();
  return (
    <div className={cn("grid gap-4", compact ? "sm:grid-cols-2 xl:grid-cols-3" : "md:grid-cols-2 xl:grid-cols-3")}>
      {goals.map((g) => {
        const m = goalMetric(g.metric);
        const v = progress.get(g.id) ?? 0;
        const pct = Math.min(100, Math.round((v / Number(g.target)) * 100));
        const total = (new Date(g.end_date).getTime() - new Date(g.start_date).getTime()) / 86400_000 + 1;
        const elapsed = Math.min(total, Math.max(0, (new Date(today).getTime() - new Date(g.start_date).getTime()) / 86400_000 + 1));
        const expected = Math.round((elapsed / total) * 100);
        const ended = g.end_date < today;
        const state = pct >= 100 ? { label: "Achieved", tone: "text-emerald-600" } : ended ? { label: "Missed", tone: "text-rose-600" } : pct >= expected ? { label: "On track", tone: "text-emerald-600" } : { label: "Behind", tone: "text-amber-600" };
        const show = (n: number) => (m.money ? formatMoney(n) : new Intl.NumberFormat("en-IN").format(n));
        return (
          <Card key={g.id} className="group p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><Target className="h-4 w-4" /></span>
                <div className="min-w-0">
                  <div className="truncate font-semibold text-slate-900">{g.title}</div>
                  <div className="text-xs text-slate-500">{m.label} · {formatDate(g.start_date)} – {formatDate(g.end_date)}</div>
                </div>
              </div>
              {canDelete && (
                <ConfirmForm action={deleteGoal} message={`Delete goal “${g.title}”?`}>
                  <input type="hidden" name="id" value={g.id} />
                  <button className="rounded p-1 text-slate-300 opacity-0 hover:text-rose-600 group-hover:opacity-100 focus:opacity-100 [@media(hover:none)]:opacity-100" aria-label="Delete goal"><Trash2 className="h-4 w-4" /></button>
                </ConfirmForm>
              )}
            </div>
            <div className="mt-4 flex items-end justify-between">
              <div><span className="text-xl font-bold text-slate-900">{show(v)}</span><span className="text-sm text-slate-400"> / {show(Number(g.target))}</span></div>
              <span className={cn("text-xs font-semibold", state.tone)}>{state.label}</span>
            </div>
            <div className="relative mt-2 h-2.5 rounded-full bg-slate-100">
              <div className="h-2.5 rounded-full bg-gradient-to-r from-brand-500 to-accent-500" style={{ width: `${pct}%` }} />
              {!ended && pct < 100 && <div className="absolute -top-1 w-0.5 rounded bg-slate-400" style={{ left: `${expected}%`, height: 18 }} title={`Where you should be today: ${expected}%`} />}
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
              <span>{pct}% done</span>
              {g.staff_id ? <span className="flex items-center gap-1.5"><Avatar name={staffNames.get(g.staff_id)} className="h-5 w-5 text-[8px]" />{staffNames.get(g.staff_id)}</span> : <span>Whole company</span>}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
