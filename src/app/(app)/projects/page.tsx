import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock, FolderKanban, Plus } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SearchInput } from "@/components/ui/search-input";
import { requireStaff } from "@/lib/auth";
import { PROJECT_STATUSES, projectStatus } from "@/lib/constants";
import { cn, formatDate, formatMoney, searchTerm } from "@/lib/utils";
import { todayIST } from "@/lib/dates";

export const metadata: Metadata = { title: "Projects" };

type SP = { q?: string; status?: string; mine?: string };

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const { supabase, can, profile } = await requireStaff();
  if (!can("projects", "view")) notFound();

  let q = supabase
    .from("projects")
    .select("id, name, status, billing_type, fixed_price, hourly_rate, start_date, deadline, customer:customers(id, company), project_members(staff_id, staff:profiles(full_name))")
    .order("deadline", { ascending: true, nullsFirst: false });
  const term = sp.q ? searchTerm(sp.q) : "";
  if (term) q = q.ilike("name", `%${term}%`);
  if (sp.status) q = q.eq("status", sp.status);
  const { data: projects } = await q;
  const rows = (projects ?? []).filter((p) => !sp.mine || p.project_members.some((m) => m.staff_id === profile.id));

  // Progress = completed tasks / all tasks; hours from timesheets
  const ids = rows.map((p) => p.id);
  const [{ data: tasks }, { data: hours }, { data: counts }] = await Promise.all([
    ids.length ? supabase.from("tasks").select("rel_id, status").eq("rel_type", "project").in("rel_id", ids) : Promise.resolve({ data: [] as { rel_id: number | null; status: string }[] }),
    ids.length ? supabase.from("timesheets").select("project_id, hours").in("project_id", ids) : Promise.resolve({ data: [] as { project_id: number; hours: number }[] }),
    supabase.from("projects").select("status"),
  ]);
  const prog = (id: number) => {
    const ts = (tasks ?? []).filter((t) => t.rel_id === id);
    return { total: ts.length, done: ts.filter((t) => t.status === "complete").length };
  };
  const hrs = (id: number) => (hours ?? []).filter((h) => h.project_id === id).reduce((s, h) => s + Number(h.hours), 0);
  const today = todayIST();

  const href = (patch: Partial<SP>) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...patch })) if (v) next.set(k, v);
    const qs = next.toString();
    return qs ? `/projects?${qs}` : "/projects";
  };
  const pill = (active: boolean) =>
    cn("rounded-full px-3 py-1 text-xs font-medium", active ? "bg-ink-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50");

  return (
    <>
      <PageHeader
        title="Projects"
        description="Delivery work for customers — milestones, tasks, time and files."
        actions={can("projects", "edit") && <LinkButton href="/projects/new"><Plus className="h-4 w-4" /> New project</LinkButton>}
      />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {PROJECT_STATUSES.map((s) => (
          <Link key={s.value} href={href({ status: sp.status === s.value ? undefined : s.value })}>
            <Card className={cn("px-4 py-3 transition hover:border-brand-200", sp.status === s.value && "border-brand-400 ring-2 ring-brand-100")}>
              <div className="text-2xl font-bold text-slate-900">{(counts ?? []).filter((c) => c.status === s.value).length}</div>
              <div className="text-xs font-medium text-slate-500">{s.label}</div>
            </Card>
          </Link>
        ))}
      </div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1.5">
          <Link href={href({ mine: undefined })} className={pill(!sp.mine)}>All projects</Link>
          <Link href={href({ mine: "1" })} className={pill(!!sp.mine)}>My projects</Link>
        </div>
        <SearchInput placeholder="Search projects…" />
      </div>

      {!rows.length ? (
        <Card><EmptyState icon={FolderKanban} title="No projects here" description="Create a project to plan delivery and track time." /></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((p) => {
            const s = projectStatus(p.status);
            const pr = prog(p.id);
            const pct = pr.total ? Math.round((pr.done / pr.total) * 100) : 0;
            const late = p.deadline && p.deadline < today && p.status !== "finished" && p.status !== "cancelled";
            return (
              <Link key={p.id} href={`/projects/${p.id}`} className="group">
                <Card className="flex h-full flex-col p-5 transition group-hover:-translate-y-0.5 group-hover:shadow-pop">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold text-slate-900 group-hover:text-brand-700">{p.name}</h3>
                      <p className="truncate text-sm text-slate-500">{p.customer?.company}</p>
                    </div>
                    <Badge className={s.color}>{s.label}</Badge>
                  </div>
                  <div className="mt-5">
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="text-slate-500">{pr.done}/{pr.total} tasks</span>
                      <span className="font-semibold text-slate-700">{pct}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100">
                      <div className="h-2 rounded-full bg-gradient-to-r from-brand-500 to-accent-400" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <div className="mt-5 flex items-end justify-between">
                    <div className="flex -space-x-1.5">
                      {p.project_members.slice(0, 4).map((m) => (
                        <Avatar key={m.staff_id} name={m.staff?.full_name} className="h-7 w-7 text-[10px] ring-2 ring-white" />
                      ))}
                    </div>
                    <div className="text-right text-xs">
                      <div className={cn("flex items-center justify-end gap-1", late ? "font-semibold text-rose-600" : "text-slate-500")}>
                        <CalendarClock className="h-3.5 w-3.5" /> {formatDate(p.deadline)}
                      </div>
                      <div className="mt-0.5 text-slate-400">
                        {p.billing_type === "hourly" ? `${hrs(p.id)} h · ${formatMoney(Number(p.hourly_rate))}/h` : formatMoney(Number(p.fixed_price))}
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
