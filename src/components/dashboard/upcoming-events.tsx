import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/card";
import { requireStaff } from "@/lib/auth";
import { CAL_KIND, isoDate, loadCalendarItems } from "@/lib/calendar";
import { todayIST } from "@/lib/dates";
import { cn } from "@/lib/utils";

/** This month at a glance (dots per day) and what's coming up next. */
export async function UpcomingEvents({ className }: { className?: string }) {
  const ctx = await requireStaff();
  const today = todayIST();
  const [y, m] = today.split("-").map(Number) as [number, number];
  const first = new Date(y, m - 1, 1);
  const gridStart = new Date(first);
  gridStart.setDate(1 - ((first.getDay() + 6) % 7)); // Monday-first
  const days = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });
  const items = await loadCalendarItems(ctx, isoDate(days[0]!), isoDate(days[41]!));
  const byDay = new Map<string, string[]>();
  for (const it of items) byDay.set(it.date, [...(byDay.get(it.date) ?? []), it.color]);
  const upcoming = items.filter((i) => i.date >= today).slice(0, 6);
  const dayLabel = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  return (
    <Card className={className}>
      <CardHeader
        title="Upcoming events"
        description={first.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
        action={<Link href="/calendar" className="text-xs font-semibold text-brand-600 hover:text-brand-700">Calendar →</Link>}
      />
      <div className="px-4 pt-3">
        <div className="grid grid-cols-7 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <div key={i} className="py-1">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 text-center">
          {days.map((d) => {
            const k = isoDate(d);
            const dots = byDay.get(k) ?? [];
            const inMonth = d.getMonth() === m - 1;
            const label = `${dayLabel(k)}: ${dots.length ? `${dots.length} item${dots.length === 1 ? "" : "s"}` : "nothing scheduled"}`;
            return (
              <div key={k} className="flex flex-col items-center py-0.5" title={label} aria-label={label}>
                <span className={cn("flex h-6 w-6 items-center justify-center rounded-full text-xs", k === today ? "bg-brand-600 font-semibold text-white" : inMonth ? "text-slate-700" : "text-slate-300")}>{d.getDate()}</span>
                <span className="flex h-1.5 gap-0.5">
                  {dots.slice(0, 3).map((c, i) => <span key={i} className="h-1 w-1 rounded-full" style={{ background: c }} />)}
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 border-t border-slate-100 pt-2 text-[10px] text-slate-500">
          {Object.values(CAL_KIND).map((k) => (
            <span key={k.label} className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full" style={{ background: k.color }} />{k.label}</span>
          ))}
        </div>
      </div>
      <ul className="mt-2 divide-y divide-slate-100 border-t border-slate-100">
        {upcoming.map((it, i) => (
          <li key={i}>
            <Link href={it.href === "#" ? "/calendar" : it.href} className="flex items-center gap-3 px-5 py-2 text-sm hover:bg-slate-50">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: it.color }} />
              <span className="min-w-0 flex-1 truncate text-slate-800">{it.title}</span>
              <span className="shrink-0 text-xs text-slate-400">
                {it.date === today ? "Today" : new Date(`${it.date}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                {it.time ? ` · ${it.time}` : ""}
              </span>
            </Link>
          </li>
        ))}
        {!upcoming.length && <li className="px-5 py-6 text-center text-sm text-slate-400">Nothing scheduled.</li>}
      </ul>
    </Card>
  );
}
