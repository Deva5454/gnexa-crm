import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { PageHeader } from "@/components/ui/page-header";
import { requireFeature, requireStaff } from "@/lib/auth";
import { CAL_KIND as KIND, isoDate as iso, loadCalendarItems, type CalItem as Item } from "@/lib/calendar";
import { cn } from "@/lib/utils";
import { deleteEvent } from "./actions";
import { EventForm } from "./event-form";

export const metadata: Metadata = { title: "Calendar" };

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  await requireFeature("calendar"); // Setup → Modules
  const m = (await searchParams).m;
  const ctx = await requireStaff();
  const now = new Date();
  const [y, mo] = m && /^\d{4}-\d{2}$/.test(m) ? m.split("-").map(Number) : [now.getFullYear(), now.getMonth() + 1];
  const first = new Date(y!, mo! - 1, 1);
  const gridStart = new Date(first);
  gridStart.setDate(1 - ((first.getDay() + 6) % 7)); // Monday-first
  const gridEnd = new Date(gridStart);
  gridEnd.setDate(gridStart.getDate() + 41);
  const from = iso(gridStart);
  const to = iso(gridEnd);
  const items = await loadCalendarItems(ctx, from, to);

  const byDay = new Map<string, Item[]>();
  for (const it of items) byDay.set(it.date, [...(byDay.get(it.date) ?? []), it]);
  const days = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });
  const today = iso(now);
  const prev = new Date(y!, mo! - 2, 1);
  const next = new Date(y!, mo!, 1);
  const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const upcoming = items.filter((i) => i.date >= today).slice(0, 8);

  return (
    <>
      <PageHeader
        title={first.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
        description="Your events plus everything with a date across the CRM."
        actions={
          <div className="flex items-center gap-1">
            <Link href={`/calendar?m=${key(prev)}`} className={buttonClass({ variant: "secondary", size: "icon" })} aria-label="Previous month"><ChevronLeft className="h-4 w-4" /></Link>
            <Link href="/calendar" className={buttonClass({ variant: "secondary", size: "sm" })}>Today</Link>
            <Link href={`/calendar?m=${key(next)}`} className={buttonClass({ variant: "secondary", size: "icon" })} aria-label="Next month"><ChevronRight className="h-4 w-4" /></Link>
          </div>
        }
      />
      <div className="mb-4 flex flex-wrap gap-4 text-xs text-slate-600">
        {Object.values(KIND).map((k) => <span key={k.label} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: k.color }} />{k.label}</span>)}
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_300px]">
        <Card className="overflow-hidden">
          <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/60 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="py-2">{d}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {days.map((d) => {
              const k = iso(d);
              const list = byDay.get(k) ?? [];
              const inMonth = d.getMonth() === mo! - 1;
              return (
                <div key={k} className={cn("min-h-[110px] border-b border-r border-slate-100 p-1.5", !inMonth && "bg-slate-50/60")}>
                  <div className={cn("mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs", k === today ? "bg-brand-600 font-semibold text-white" : inMonth ? "text-slate-700" : "text-slate-300")}>{d.getDate()}</div>
                  <ul className="space-y-0.5">
                    {list.slice(0, 3).map((it, i) => (
                      <li key={i}>
                        <Link href={it.href} title={it.title} className="flex items-center gap-1 truncate rounded px-1 py-0.5 text-[11px] text-slate-700 hover:bg-slate-100">
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: it.color }} />
                          {it.time && <span className="text-slate-400">{it.time}</span>}
                          <span className="truncate">{it.title}</span>
                        </Link>
                      </li>
                    ))}
                    {list.length > 3 && (
                      <li>
                        <details className="text-[11px]">
                          <summary className="cursor-pointer px-1 text-slate-500 hover:text-brand-700">+{list.length - 3} more</summary>
                          <ul className="mt-0.5 space-y-0.5">
                            {list.slice(3).map((it, i) => (
                              <li key={i}><Link href={it.href} className="flex items-center gap-1 truncate rounded px-1 text-slate-700 hover:bg-slate-100"><span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: it.color }} /><span className="truncate">{it.title}</span></Link></li>
                            ))}
                          </ul>
                        </details>
                      </li>
                    )}
                  </ul>
                </div>
              );
            })}
          </div>
        </Card>
        <aside className="space-y-6">
          <Card>
            <CardHeader title="New event" />
            <CardBody><EventForm defaultDate={today} /></CardBody>
          </Card>
          <Card>
            <CardHeader title="Coming up" />
            <ul className="divide-y divide-slate-100">
              {upcoming.map((it, i) => (
                <li key={i} className="group flex items-center gap-3 px-5 py-2.5 text-sm">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: it.color }} />
                  <Link href={it.href} className="min-w-0 flex-1">
                    <div className="truncate text-slate-800">{it.title}</div>
                    <div className="text-xs text-slate-400">{new Date(`${it.date}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}{it.time ? ` · ${it.time}` : ""}</div>
                  </Link>
                  {it.eventId && it.mine && (
                    <ConfirmForm action={deleteEvent} message={`Delete “${it.title}”?`}>
                      <input type="hidden" name="id" value={it.eventId} />
                      <button className="text-slate-300 opacity-0 hover:text-rose-600 group-hover:opacity-100 focus:opacity-100 [@media(hover:none)]:opacity-100" aria-label="Delete event"><Trash2 className="h-3.5 w-3.5" /></button>
                    </ConfirmForm>
                  )}
                </li>
              ))}
              {!upcoming.length && <li className="px-5 py-6 text-sm text-slate-400">Nothing scheduled.</li>}
            </ul>
          </Card>
        </aside>
      </div>
    </>
  );
}
