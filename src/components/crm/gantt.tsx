import Link from "next/link";
import { taskStatus } from "@/lib/constants";
import { cn, formatDate } from "@/lib/utils";

type GTask = { id: number; name: string; status: string; start_date: string | null; due_date: string | null; milestone_id: number | null };
type GMilestone = { id: number; name: string; due_date: string | null; is_complete: boolean };

const BAR: Record<string, string> = {
  not_started: "bg-slate-300",
  in_progress: "bg-sky-500",
  testing: "bg-violet-500",
  awaiting_feedback: "bg-amber-500",
  complete: "bg-accent-500",
};
const day = (iso: string) => Math.floor(new Date(`${iso}T00:00:00Z`).getTime() / 86400_000);
const iso = (d: number) => new Date(d * 86400_000).toISOString().slice(0, 10);

/** Project timeline: one bar per task (start → due), milestones as diamonds, a line for today. */
export function Gantt({ start, end, tasks, milestones }: { start: string; end: string | null; tasks: GTask[]; milestones: GMilestone[] }) {
  const today = day(new Date().toISOString().slice(0, 10));
  const dates = [
    day(start),
    ...(end ? [day(end)] : []),
    ...tasks.flatMap((t) => [t.start_date, t.due_date].filter((x): x is string => !!x).map(day)),
    ...milestones.filter((m) => m.due_date).map((m) => day(m.due_date!)),
  ];
  const from = Math.min(...dates) - 2;
  const to = Math.max(...dates, today) + 3;
  const span = Math.max(14, to - from);
  const pct = (d: number) => ((d - from) / span) * 100;

  // Month boundaries for the header, plus week ticks when the range is short
  const ticks: { at: number; label: string; major: boolean }[] = [];
  for (let d = from; d <= to; d++) {
    const date = new Date(d * 86400_000);
    if (date.getUTCDate() === 1) ticks.push({ at: d, label: date.toLocaleDateString("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" }), major: true });
    else if (span <= 120 && date.getUTCDay() === 1) ticks.push({ at: d, label: String(date.getUTCDate()), major: false });
  }
  // Drop week labels that would crowd a month label
  const months = ticks.filter((t) => t.major).map((t) => t.at);
  for (let i = ticks.length - 1; i >= 0; i--) if (!ticks[i]!.major && months.some((m) => Math.abs(m - ticks[i]!.at) < 4)) ticks.splice(i, 1);

  const groups = [
    ...milestones.map((m) => ({ key: m.id, m, items: tasks.filter((t) => t.milestone_id === m.id) })),
    { key: 0, m: null as GMilestone | null, items: tasks.filter((t) => !t.milestone_id || !milestones.some((m) => m.id === t.milestone_id)) },
  ].filter((g) => g.m || g.items.length);
  const undated = tasks.filter((t) => !t.start_date && !t.due_date);

  const Row = ({ children, label, sub }: { children: React.ReactNode; label: React.ReactNode; sub?: string }) => (
    <div className="grid grid-cols-[200px_1fr] border-b border-slate-100 last:border-0 sm:grid-cols-[240px_1fr]">
      <div className="truncate border-r border-slate-100 px-3 py-2 text-sm">
        {label}
        {sub && <div className="truncate text-[11px] text-slate-400">{sub}</div>}
      </div>
      <div className="relative">{children}</div>
    </div>
  );

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[760px]">
        {/* Scale */}
        <div className="grid grid-cols-[200px_1fr] border-b border-slate-200 bg-slate-50/80 text-[11px] text-slate-500 sm:grid-cols-[240px_1fr]">
          <div className="border-r border-slate-200 px-3 py-2 font-semibold uppercase tracking-wider">Task</div>
          <div className="relative h-8">
            {ticks.map((t) => (
              <span key={t.at} className={cn("absolute top-0 h-full border-l pl-1 pt-2", t.major ? "border-slate-300 font-semibold text-slate-700" : "border-slate-200")} style={{ left: `${pct(t.at)}%` }}>
                {t.label}
              </span>
            ))}
          </div>
        </div>
        <div className="relative">
          {/* Today */}
          <div className="pointer-events-none absolute inset-y-0 z-10 grid w-full grid-cols-[200px_1fr] sm:grid-cols-[240px_1fr]">
            <div />
            <div className="relative">
              <div className="absolute inset-y-0 w-px bg-rose-400" style={{ left: `${pct(today)}%` }}>
                <span className="absolute -top-0 left-1 rounded bg-rose-500 px-1 text-[9px] font-bold uppercase text-white">Today</span>
              </div>
            </div>
          </div>
          {groups.map((g) => (
            <div key={g.key}>
              <Row label={<b className="text-slate-800">{g.m ? g.m.name : "Other tasks"}</b>} sub={g.m?.due_date ? `Milestone · ${formatDate(g.m.due_date)}` : undefined}>
                {g.m?.due_date && (
                  <span
                    className={cn("absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-sm ring-2 ring-white", g.m.is_complete ? "bg-accent-500" : "bg-ink-900")}
                    style={{ left: `${pct(day(g.m.due_date))}%` }}
                    title={`${g.m.name} — ${formatDate(g.m.due_date)}${g.m.is_complete ? " (done)" : ""}`}
                  />
                )}
              </Row>
              {g.items.filter((t) => t.start_date || t.due_date).map((t) => {
                const s = day(t.start_date ?? t.due_date!);
                const e = Math.max(s, day(t.due_date ?? t.start_date!));
                const late = t.status !== "complete" && e < today;
                return (
                  <Row key={t.id} label={<Link href={`/tasks/${t.id}`} className={cn("pl-3 text-slate-700 hover:text-brand-700", t.status === "complete" && "text-slate-400 line-through")}>{t.name}</Link>}>
                    <Link
                      href={`/tasks/${t.id}`}
                      title={`${t.name}: ${formatDate(iso(s))} → ${formatDate(iso(e))} · ${taskStatus(t.status).label}`}
                      className={cn("absolute top-1/2 h-4 -translate-y-1/2 rounded-full", BAR[t.status] ?? "bg-slate-300", late && "ring-2 ring-rose-400")}
                      style={{ left: `${pct(s)}%`, width: `max(${((e - s + 1) / span) * 100}%, 8px)` }}
                    />
                  </Row>
                );
              })}
            </div>
          ))}
        </div>
        {/* Legend */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-100 px-3 py-2.5 text-[11px] text-slate-500">
          {Object.keys(BAR).map((k) => <span key={k} className="flex items-center gap-1.5"><span className={cn("h-2.5 w-4 rounded-full", BAR[k])} />{taskStatus(k).label}</span>)}
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-full bg-slate-300 ring-2 ring-rose-400" />Overdue</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rotate-45 rounded-sm bg-ink-900" />Milestone</span>
        </div>
        {undated.length > 0 && <p className="border-t border-slate-100 px-3 py-2 text-xs text-slate-400">Not shown (no dates): {undated.map((t) => t.name).join(", ")}</p>}
      </div>
    </div>
  );
}
