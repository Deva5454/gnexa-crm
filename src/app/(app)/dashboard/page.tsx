import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AnnouncementBanner } from "@/components/crm/announcement-banner";
import { DashboardGoals } from "@/components/crm/dashboard-goals";
import { TodoWidget } from "@/components/crm/todo-widget";
import { ContractsExpiring } from "@/components/dashboard/contracts-expiring";
import { DashboardOptions } from "@/components/dashboard/dashboard-options";
import { FinanceOverview } from "@/components/dashboard/finance-overview";
import { LeadsOverview, LeadsSources } from "@/components/dashboard/leads-widgets";
import { PaymentsChart } from "@/components/dashboard/payments-chart";
import { ProjectActivity, ProjectsChart } from "@/components/dashboard/project-widgets";
import { arrangeWidgets, readDashboardConfig, SIZE_CLASS } from "@/components/dashboard/registry";
import { TicketsChart } from "@/components/dashboard/tickets-chart";
import { TopStats } from "@/components/dashboard/top-stats";
import { UpcomingEvents } from "@/components/dashboard/upcoming-events";
import { UserData } from "@/components/dashboard/user-data";
import { requireStaff } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

function greeting() {
  const h = Number(new Date().toLocaleString("en-IN", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" }));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

const Skeleton = ({ className }: { className: string }) => <div className={cn("card h-48 animate-pulse bg-slate-50", className)} aria-hidden />;

export default async function DashboardPage() {
  const { supabase, profile, can, roleName, featureOn } = await requireStaff();
  const { data: news } = featureOn("announcements")
    ? await supabase.from("announcements").select("id, title, body").eq("show_to_staff", true).order("created_at", { ascending: false }).limit(1).maybeSingle()
    : { data: null };

  // Which widgets this role can see at all (Setup → Modules and role permissions)
  const available: Record<string, boolean> = {
    top_stats: true,
    finance_overview: can("sales", "view"),
    user_data: true,
    calendar: featureOn("calendar"),
    payments_chart: can("sales", "view"),
    todos: featureOn("todos"),
    leads_overview: can("leads", "view"),
    leads_sources: can("leads", "view"),
    projects_chart: can("projects", "view"),
    tickets_chart: can("support", "view"),
    project_activity: can("projects", "view"),
    goals: featureOn("goals") && can("reports", "view"),
    contracts_expiring: can("contracts", "view"),
  };
  const widgets = arrangeWidgets(readDashboardConfig(profile.dashboard_config)).filter((w) => available[w.key]);

  const render = (key: string, className: string) => {
    switch (key) {
      case "top_stats": return <TopStats className={className} />;
      case "finance_overview": return <FinanceOverview className={className} />;
      case "user_data": return <UserData className={className} showAnnouncements={featureOn("announcements")} />;
      case "calendar": return <UpcomingEvents className={className} />;
      case "payments_chart": return <PaymentsChart className={className} />;
      case "todos": return <TodoWidget className={className} />;
      case "leads_overview": return <LeadsOverview className={className} />;
      case "leads_sources": return <LeadsSources className={className} />;
      case "projects_chart": return <ProjectsChart className={className} />;
      case "tickets_chart": return <TicketsChart className={className} />;
      case "project_activity": return <ProjectActivity className={className} />;
      case "goals": return <DashboardGoals className={className} />;
      case "contracts_expiring": return <ContractsExpiring className={className} />;
      default: return null;
    }
  };

  return (
    <>
      {news && <AnnouncementBanner id={news.id} title={news.title} body={news.body} />}
      <div className="relative mb-6 overflow-hidden rounded-3xl bg-ink-900 px-6 py-7 text-white sm:px-8">
        <div className="absolute -right-16 -top-24 h-64 w-64 rounded-full bg-brand-500/40 blur-3xl" />
        <div className="absolute -bottom-24 right-40 h-56 w-56 rounded-full bg-accent-500/30 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-slate-400">
              {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata" })} ·{" "}
              <span className="font-medium text-accent-400">Viewing as {roleName}</span>
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
              {greeting()}, {profile.full_name.split(" ")[0] || "there"} 👋
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <DashboardOptions key={JSON.stringify(widgets)} widgets={widgets.map(({ key, label, hidden }) => ({ key, label, hidden }))} />
            {can("leads", "edit") && (
              <Link href="/leads/new" className="rounded-lg bg-white/10 px-3 py-2 text-sm font-medium backdrop-blur hover:bg-white/20">+ Lead</Link>
            )}
            {can("tasks", "edit") && (
              <Link href="/tasks/new" className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-ink-900 hover:bg-slate-100">+ Task</Link>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-flow-row-dense grid-cols-1 gap-6 xl:grid-cols-3">
        {widgets
          .filter((w) => !w.hidden)
          .map((w) => (
            <Suspense key={w.key} fallback={<Skeleton className={SIZE_CLASS[w.size]} />}>
              {render(w.key, SIZE_CLASS[w.size])}
            </Suspense>
          ))}
      </div>
      {widgets.every((w) => w.hidden) && (
        <p className="py-16 text-center text-sm text-slate-400">All widgets are hidden — open Dashboard options to bring some back.</p>
      )}
    </>
  );
}
