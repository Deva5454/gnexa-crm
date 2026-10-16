import type { Metadata } from "next";
import Link from "next/link";
import { AlarmClock, ArrowUpRight, Building2, Magnet, Target, TrendingUp } from "lucide-react";
import { TodoWidget } from "@/components/crm/todo-widget";
import { ActivityFeed } from "@/components/crm/activity-feed";
import { FinanceStrip } from "@/components/sales/finance-strip";
import { WorkStrip } from "@/components/crm/work-strip";
import { AnnouncementBanner } from "@/components/crm/announcement-banner";
import { DashboardGoals } from "@/components/crm/dashboard-goals";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { requireStaff } from "@/lib/auth";
import { taskPriority } from "@/lib/constants";
import { cn, formatDate, formatMoney } from "@/lib/utils";
import { CompleteToggle } from "../tasks/status-select";
import { allRows } from "@/lib/fetch-all";
import { todayIST } from "@/lib/dates";

export const metadata: Metadata = { title: "Dashboard" };

function greeting() {
  const h = Number(new Date().toLocaleString("en-IN", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" }));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default async function DashboardPage() {
  const { supabase, profile, can, roleName } = await requireStaff();
  // Recurring billing is raised by the scheduled job (see 0020_scheduling.sql), not on page loads
  const today = todayIST();
  const since = new Date(Date.now() - 13 * 86400_000);
  since.setHours(0, 0, 0, 0);

  const [{ data: leads }, { data: statuses }, { data: sources }, customers, { data: myTasks }, overdue, { data: settings }, { data: news }, { count: openCount }] = await Promise.all([
    allRows((a, b) => supabase.from("leads").select("id, status_id, source_id, value, is_lost, is_junk, converted_customer_id, created_at").order("id").range(a, b)),
    supabase.from("lead_statuses").select("id, name, color").order("sort_order"),
    supabase.from("lead_sources").select("id, name"),
    supabase.from("customers").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase
      .from("tasks")
      .select("id, name, status, priority, due_date, task_assignees!inner(staff_id)")
      .eq("task_assignees.staff_id", profile.id)
      .neq("status", "complete")
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(7),
    supabase
      .from("tasks")
      .select("id, task_assignees!inner(staff_id)", { count: "exact", head: true })
      .eq("task_assignees.staff_id", profile.id)
      .neq("status", "complete")
      .lt("due_date", today),
    supabase.from("company_settings").select("currency").maybeSingle(),
    supabase.from("announcements").select("id, title, body").eq("show_to_staff", true).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    // the list above shows 7; this counts them all
    supabase.from("tasks").select("id, task_assignees!inner(staff_id)", { count: "exact", head: true }).eq("task_assignees.staff_id", profile.id).neq("status", "complete"),
  ]);

  const currency = settings?.currency ?? "INR";
  const all = leads ?? [];
  const open = all.filter((l) => !l.is_lost && !l.is_junk && !l.converted_customer_id);
  const converted = all.filter((l) => l.converted_customer_id).length;
  const decided = all.filter((l) => l.converted_customer_id || l.is_lost).length;
  const winRate = decided ? Math.round((converted / decided) * 100) : 0;
  const pipeline = open.reduce((s, l) => s + (l.value ?? 0), 0);

  const byStage = (statuses ?? []).map((s) => {
    const items = open.filter((l) => l.status_id === s.id);
    return { ...s, count: items.length, value: items.reduce((a, l) => a + (l.value ?? 0), 0) };
  });
  const maxStage = Math.max(1, ...byStage.map((s) => s.count));

  const bySource = (sources ?? [])
    .map((s) => ({ name: s.name, count: all.filter((l) => l.source_id === s.id).length }))
    .filter((s) => s.count > 0)
    .sort((a, b) => b.count - a.count);
  const maxSource = Math.max(1, ...bySource.map((s) => s.count));

  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(since.getTime() + i * 86400_000);
    const key = d.toISOString().slice(0, 10);
    return { key, label: d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }), count: 0 };
  });
  for (const l of all) {
    const k = l.created_at.slice(0, 10);
    const d = days.find((x) => x.key === k);
    if (d) d.count++;
  }
  const maxDay = Math.max(1, ...days.map((d) => d.count));
  const newThisFortnight = days.reduce((s, d) => s + d.count, 0);

  const kpis = [
    { label: "Open pipeline", value: formatMoney(pipeline, currency), sub: `${open.length} open leads`, icon: Magnet, tint: "from-brand-500 to-brand-400", href: "/leads" },
    { label: "Active customers", value: String(customers.count ?? 0), sub: `${converted} won from leads`, icon: Building2, tint: "from-accent-500 to-teal-400", href: "/customers" },
    { label: "Win rate", value: `${winRate}%`, sub: `${converted} won · ${decided - converted} lost`, icon: Target, tint: "from-amber-500 to-orange-400", href: "/leads?view=list" },
    { label: "Overdue tasks", value: String(overdue.count ?? 0), sub: "assigned to you", icon: AlarmClock, tint: "from-rose-500 to-pink-400", href: "/tasks?due=overdue" },
  ];

  return (
    <>
      {news && <AnnouncementBanner id={news.id} title={news.title} body={news.body} />}
      <div className="relative mb-8 overflow-hidden rounded-3xl bg-ink-900 px-6 py-7 text-white sm:px-8">
        <div className="absolute -right-16 -top-24 h-64 w-64 rounded-full bg-brand-500/40 blur-3xl" />
        <div className="absolute -bottom-24 right-40 h-56 w-56 rounded-full bg-accent-500/30 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-slate-400">
              {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })} ·{" "}
              <span className="font-medium text-accent-400">Viewing as {roleName}</span>
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
              {greeting()}, {profile.full_name.split(" ")[0] || "there"} 👋
            </h1>
            <p className="mt-1 text-sm text-slate-300">
              {newThisFortnight} new leads in the last two weeks · {openCount ?? myTasks?.length ?? 0} open tasks on your plate
            </p>
          </div>
          <div className="flex gap-2">
            {can("leads", "edit") && (
              <Link href="/leads/new" className="rounded-lg bg-white/10 px-3 py-2 text-sm font-medium backdrop-blur hover:bg-white/20">+ Lead</Link>
            )}
            {can("tasks", "edit") && (
              <Link href="/tasks/new" className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-ink-900 hover:bg-slate-100">+ Task</Link>
            )}
          </div>
        </div>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <Link key={k.label} href={k.href} className="group">
            <Card className="relative overflow-hidden p-5 transition group-hover:-translate-y-0.5 group-hover:shadow-pop">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs font-medium text-slate-500">{k.label}</div>
                  <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{k.value}</div>
                  <div className="mt-1 text-xs text-slate-400">{k.sub}</div>
                </div>
                <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm", k.tint)}>
                  <k.icon className="h-5 w-5" />
                </div>
              </div>
              <ArrowUpRight className="absolute bottom-4 right-4 h-4 w-4 text-slate-300 transition group-hover:text-brand-500" />
            </Card>
          </Link>
        ))}
      </div>

      <FinanceStrip />
      <WorkStrip />
      <DashboardGoals />

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Pipeline by stage" description="Open leads only" action={<Link href="/leads" className="text-xs font-semibold text-brand-600 hover:text-brand-700">Open board →</Link>} />
          <CardBody className="space-y-4">
            {byStage.map((s) => (
              <div key={s.id} className="grid grid-cols-[110px_1fr_auto] items-center gap-3 text-sm sm:grid-cols-[140px_1fr_120px]">
                <span className="truncate font-medium text-slate-700">{s.name}</span>
                <div className="h-7 overflow-hidden rounded-lg bg-slate-100">
                  <div
                    className="flex h-full items-center rounded-lg px-2 text-xs font-semibold text-white transition-all"
                    style={{ width: `${Math.max(s.count ? 8 : 0, (s.count / maxStage) * 100)}%`, backgroundColor: s.color }}
                  >
                    {s.count > 0 && s.count}
                  </div>
                </div>
                <span className="text-right text-xs font-medium text-slate-500">{formatMoney(s.value, currency)}</span>
              </div>
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="My open tasks" action={<Link href="/tasks" className="text-xs font-semibold text-brand-600 hover:text-brand-700">All tasks →</Link>} />
          {!myTasks?.length ? (
            <p className="px-5 py-10 text-center text-sm text-slate-400">Nothing assigned — enjoy the calm ✨</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {myTasks.map((t) => {
                const late = t.due_date && t.due_date < today;
                return (
                  <li key={t.id} className="flex items-center gap-3 px-5 py-3">
                    <CompleteToggle id={t.id} done={false} />
                    <Link href={`/tasks/${t.id}`} className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800 hover:text-brand-700">{t.name}</Link>
                    <span className={cn("text-[11px] font-semibold", taskPriority(t.priority).color)}>{taskPriority(t.priority).label}</span>
                    <span className={cn("w-20 text-right text-xs", late ? "font-semibold text-rose-600" : "text-slate-400")}>{formatDate(t.due_date)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader title="New leads" description="Last 14 days" action={<TrendingUp className="h-4 w-4 text-accent-500" />} />
          <CardBody>
            <div className="flex h-44 items-end gap-1.5">
              {days.map((d) => (
                <div key={d.key} className="group flex flex-1 flex-col items-center gap-1.5">
                  <span className="text-[10px] font-semibold text-slate-500 opacity-0 transition group-hover:opacity-100">{d.count}</span>
                  <div
                    className="w-full rounded-t-md bg-gradient-to-t from-brand-500 to-accent-400 transition group-hover:opacity-80"
                    style={{ height: `${Math.max(4, (d.count / maxDay) * 130)}px`, opacity: d.count ? 1 : 0.15 }}
                  />
                  <span className="hidden text-[10px] text-slate-400 sm:block">{d.label.split(" ")[0]}</span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Leads by source" />
          <CardBody className="space-y-3">
            {!bySource.length && <p className="py-6 text-center text-sm text-slate-400">No leads yet.</p>}
            {bySource.map((s) => (
              <div key={s.name}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="font-medium text-slate-700">{s.name}</span>
                  <span className="text-slate-500">{s.count}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100">
                  <div className="h-2 rounded-full bg-accent-500" style={{ width: `${(s.count / maxSource) * 100}%` }} />
                </div>
              </div>
            ))}
          </CardBody>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader title="Latest activity" description="Across the whole team" />
          <ActivityFeed limit={10} />
        </Card>
        <TodoWidget />
      </div>
    </>
  );
}
