import Link from "next/link";
import { BellRing, Megaphone } from "lucide-react";
import { CompleteToggle } from "@/app/(app)/tasks/status-select";
import { ActivityFeed } from "@/components/crm/activity-feed";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requireStaff } from "@/lib/auth";
import { projectStatus, taskPriority, ticketNumber, ticketStatus } from "@/lib/constants";
import { todayIST } from "@/lib/dates";
import { cn, formatDate, formatDateTime, timeAgo } from "@/lib/utils";
import { PanelTabs } from "./panel-tabs";

const REL_HREF: Record<string, string> = {
  customer: "/customers/",
  lead: "/leads/",
  project: "/projects/",
  ticket: "/support/",
  contract: "/contracts/",
  task: "/tasks/",
  expense: "/expenses/",
};

const Empty = ({ children }: { children: React.ReactNode }) => <p className="px-5 py-10 text-center text-sm text-slate-400">{children}</p>;
const More = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <div className="border-t border-slate-100 px-5 py-2.5 text-right">
    <Link href={href} className="text-xs font-semibold text-brand-600 hover:text-brand-700">{children} →</Link>
  </div>
);

/** Perfex's tabbed panel: My tasks, My projects, My reminders, Tickets, Announcements, Activity log. */
export async function UserData({ className, showAnnouncements }: { className?: string; showAnnouncements: boolean }) {
  const { supabase, profile, can } = await requireStaff();
  const today = todayIST();
  const none = Promise.resolve({ data: null, count: null });
  const [tasks, projects, { data: reminders }, tickets, { data: news }] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, name, priority, due_date, task_assignees!inner(staff_id)", { count: "exact" })
      .eq("task_assignees.staff_id", profile.id)
      .neq("status", "complete")
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(8),
    can("projects", "view")
      ? supabase
          .from("projects")
          .select("id, name, status, deadline, customer:customers(company), project_members!inner(staff_id)", { count: "exact" })
          .eq("project_members.staff_id", profile.id)
          .not("status", "in", "(finished,cancelled)")
          .order("deadline", { ascending: true, nullsFirst: false })
          .limit(8)
      : none,
    supabase.from("reminders").select("id, description, remind_at, rel_type, rel_id").eq("staff_id", profile.id).gte("remind_at", new Date().toISOString()).order("remind_at").limit(8),
    can("support", "view")
      ? supabase
          .from("tickets")
          .select("id, subject, status, priority, last_reply_at, customer:customers(company)", { count: "exact" })
          .in("status", ["open", "in_progress"])
          .or(`assigned_to.eq.${profile.id},assigned_to.is.null`)
          .order("last_reply_at", { ascending: false })
          .limit(8)
      : none,
    showAnnouncements ? supabase.from("announcements").select("id, title, body, created_at").eq("show_to_staff", true).order("created_at", { ascending: false }).limit(5) : Promise.resolve({ data: null }),
  ]);

  const tabs = [
    {
      key: "tasks",
      label: "My tasks",
      count: tasks.count ?? 0,
      content: !tasks.data?.length ? (
        <Empty>Nothing assigned — enjoy the calm ✨</Empty>
      ) : (
        <>
          <ul className="divide-y divide-slate-100">
            {tasks.data.map((t) => {
              const late = t.due_date && t.due_date < today;
              return (
                <li key={t.id} className="flex items-center gap-3 px-5 py-2.5">
                  <CompleteToggle id={t.id} done={false} />
                  <Link href={`/tasks/${t.id}`} className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800 hover:text-brand-700">{t.name}</Link>
                  <span className={cn("text-[11px] font-semibold", taskPriority(t.priority).color)}>{taskPriority(t.priority).label}</span>
                  <span className={cn("w-20 text-right text-xs", late ? "font-semibold text-rose-600" : "text-slate-400")}>{formatDate(t.due_date)}</span>
                </li>
              );
            })}
          </ul>
          <More href="/tasks">All tasks</More>
        </>
      ),
    },
    projects.data && {
      key: "projects",
      label: "My projects",
      count: projects.count ?? 0,
      content: !projects.data.length ? (
        <Empty>You&apos;re not on any active project.</Empty>
      ) : (
        <>
          <ul className="divide-y divide-slate-100">
            {projects.data.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                <Link href={`/projects/${p.id}`} className="min-w-0 flex-1">
                  <div className="truncate font-medium text-slate-800 hover:text-brand-700">{p.name}</div>
                  <div className="truncate text-xs text-slate-400">{p.customer?.company}</div>
                </Link>
                <Badge className={projectStatus(p.status).color}>{projectStatus(p.status).label}</Badge>
                <span className={cn("w-20 text-right text-xs", p.deadline && p.deadline < today ? "font-semibold text-rose-600" : "text-slate-400")}>{formatDate(p.deadline)}</span>
              </li>
            ))}
          </ul>
          <More href="/projects?mine=1">All my projects</More>
        </>
      ),
    },
    {
      key: "reminders",
      label: "My reminders",
      count: reminders?.length ?? 0,
      content: !reminders?.length ? (
        <Empty>No reminders coming up.</Empty>
      ) : (
        <ul className="divide-y divide-slate-100">
          {reminders.map((r) => {
            const href = REL_HREF[r.rel_type] ? `${REL_HREF[r.rel_type]}${r.rel_id}` : null;
            return (
              <li key={r.id} className="flex items-start gap-3 px-5 py-2.5 text-sm">
                <BellRing className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden />
                {href ? (
                  <Link href={href} className="min-w-0 flex-1 truncate text-slate-800 hover:text-brand-700">{r.description}</Link>
                ) : (
                  <span className="min-w-0 flex-1 truncate text-slate-800">{r.description}</span>
                )}
                <span className="shrink-0 text-xs text-slate-400" suppressHydrationWarning>{formatDateTime(r.remind_at)}</span>
              </li>
            );
          })}
        </ul>
      ),
    },
    tickets.data && {
      key: "tickets",
      label: "Tickets",
      count: tickets.count ?? 0,
      content: !tickets.data.length ? (
        <Empty>No tickets waiting on you.</Empty>
      ) : (
        <>
          <ul className="divide-y divide-slate-100">
            {tickets.data.map((t) => (
              <li key={t.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                <Link href={`/support/${t.id}`} className="min-w-0 flex-1">
                  <div className="truncate font-medium text-slate-800 hover:text-brand-700">
                    <span className="text-slate-400">{ticketNumber(t.id)}</span> {t.subject}
                  </div>
                  <div className="truncate text-xs text-slate-400">{t.customer?.company ?? "—"}</div>
                </Link>
                <Badge className={ticketStatus(t.status).color}>{ticketStatus(t.status).label}</Badge>
                <span className="w-20 text-right text-xs text-slate-400" suppressHydrationWarning>{timeAgo(t.last_reply_at)}</span>
              </li>
            ))}
          </ul>
          <More href="/support?view=mine">Open support</More>
        </>
      ),
    },
    news && {
      key: "announcements",
      label: "Announcements",
      count: news.length,
      content: !news.length ? (
        <Empty>No announcements.</Empty>
      ) : (
        <>
          <ul className="divide-y divide-slate-100">
            {news.map((a) => (
              <li key={a.id} className="flex gap-3 px-5 py-3 text-sm">
                <Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" aria-hidden />
                <div className="min-w-0">
                  <div className="font-medium text-slate-800">{a.title}</div>
                  <p className="line-clamp-2 text-xs text-slate-500">{a.body}</p>
                  <div className="mt-0.5 text-[11px] text-slate-400">{formatDate(a.created_at)}</div>
                </div>
              </li>
            ))}
          </ul>
          <More href="/announcements">All announcements</More>
        </>
      ),
    },
    { key: "activity", label: "Activity log", content: <ActivityFeed limit={10} /> },
  ].filter(Boolean) as { key: string; label: string; count?: number; content: React.ReactNode }[];

  return (
    <Card className={className}>
      <PanelTabs tabs={tabs} />
    </Card>
  );
}
