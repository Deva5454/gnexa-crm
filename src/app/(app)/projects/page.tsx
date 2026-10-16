import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowDown, ArrowUp, CalendarClock, Download, FolderKanban, LayoutGrid, List, Plus } from "lucide-react";
import { ParamSelect } from "@/components/ui/param-select";
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

type SP = { q?: string; status?: string; mine?: string; view?: string; customer?: string; member?: string; due?: string; sort?: string; dir?: string };
const SORTS = ["name", "customer", "start", "deadline", "progress"] as const;

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const { supabase, can, profile } = await requireStaff();
  if (!can("projects", "view")) notFound();

  let q = supabase
    .from("projects")
    .select("id, name, status, billing_type, fixed_price, hourly_rate, start_date, deadline, progress_manual, estimated_hours, customer:customers(id, company), project_members(staff_id, staff:profiles(full_name))")
    .order("deadline", { ascending: true, nullsFirst: false });
  const term = sp.q ? searchTerm(sp.q) : "";
  if (term) q = q.ilike("name", `%${term}%`);
  if (sp.status) q = q.eq("status", sp.status);
  if (Number(sp.customer)) q = q.eq("customer_id", Number(sp.customer));
  const [{ data: projects }, { data: staff }, { data: customers }] = await Promise.all([
    q,
    supabase.from("profiles").select("id, full_name").eq("is_active", true).order("full_name"),
    supabase.from("customers").select("id, company").order("company").limit(1000),
  ]);
  const member = sp.mine ? profile.id : sp.member;
  const todayStr = todayIST();
  const rows = (projects ?? []).filter(
    (p) =>
      (!member || p.project_members.some((m) => m.staff_id === member)) &&
      (!sp.due || (p.deadline && p.deadline < todayStr && p.status !== "finished" && p.status !== "cancelled")),
  );
  const view = sp.view === "list" ? "list" : "cards";

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
  const progressOf = (p: { id: number; progress_manual: number | null }) => {
    if (p.progress_manual != null) return p.progress_manual;
    const pr = prog(p.id);
    return pr.total ? Math.round((pr.done / pr.total) * 100) : 0;
  };
  const sortKey = (SORTS as readonly string[]).includes(sp.sort ?? "") ? (sp.sort as (typeof SORTS)[number]) : "deadline";
  const asc = sp.dir !== "desc";
  const sorted = [...rows].sort((a, b) => {
    const v = (x: (typeof rows)[number]) =>
      sortKey === "name" ? x.name.toLowerCase() : sortKey === "customer" ? (x.customer?.company ?? "").toLowerCase() : sortKey === "start" ? x.start_date : sortKey === "progress" ? String(progressOf(x)).padStart(3, "0") : (x.deadline ?? "9999");
    return (asc ? 1 : -1) * v(a).localeCompare(v(b));
  });

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
        actions={
          <>
            <div className="flex rounded-lg bg-white p-0.5 ring-1 ring-slate-200">
              <Link href={href({ view: undefined, sort: undefined, dir: undefined })} className={cn("flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium", view === "cards" ? "bg-brand-600 text-white" : "text-slate-600")}>
                <LayoutGrid className="h-3.5 w-3.5" /> Cards
              </Link>
              <Link href={href({ view: "list" })} className={cn("flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium", view === "list" ? "bg-brand-600 text-white" : "text-slate-600")}>
                <List className="h-3.5 w-3.5" /> List
              </Link>
            </div>
            <LinkButton href="/csv-export/projects" variant="secondary"><Download className="h-4 w-4" /> Export</LinkButton>
            {can("projects", "edit") && <LinkButton href="/projects/new"><Plus className="h-4 w-4" /> New project</LinkButton>}
          </>
        }
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
        <div className="flex flex-wrap items-center gap-1.5">
          <Link href={href({ mine: undefined, member: undefined })} className={pill(!sp.mine && !sp.member)}>All projects</Link>
          <Link href={href({ mine: "1", member: undefined })} className={pill(!!sp.mine)}>My projects</Link>
          <ParamSelect name="customer" label="Customer" allLabel="All customers" options={(customers ?? []).map((c) => ({ value: String(c.id), label: c.company }))} />
          <ParamSelect name="member" label="Team member" allLabel="Any member" options={(staff ?? []).map((m) => ({ value: m.id, label: m.full_name }))} />
          <ParamSelect name="due" label="Deadline" allLabel="Any deadline" options={[{ value: "overdue", label: "Past deadline" }]} />
        </div>
        <SearchInput placeholder="Search projects…" />
      </div>

      {!rows.length ? (
        <Card><EmptyState icon={FolderKanban} title="No projects here" description="Create a project to plan delivery and track time." /></Card>
      ) : view === "list" ? (
        <Card>
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th className="w-12">#</th>
                  {(
                    [
                      ["name", "Project", ""],
                      ["customer", "Customer", "hidden md:table-cell"],
                      ["start", "Start", "hidden lg:table-cell"],
                      ["deadline", "Deadline", ""],
                      ["progress", "Progress", "hidden sm:table-cell"],
                    ] as const
                  ).map(([key, label, cls]) => {
                    const on = sortKey === key;
                    const Icon = on && !asc ? ArrowDown : ArrowUp;
                    return (
                      <th key={key} className={cls} aria-sort={on ? (asc ? "ascending" : "descending") : "none"}>
                        <Link href={href({ sort: key === "deadline" ? undefined : key, dir: on && asc ? "desc" : undefined })} className={cn("inline-flex items-center gap-1 hover:text-slate-900", on && "text-slate-900")}>
                          {label}
                          <Icon className={cn("h-3 w-3", on ? "opacity-100" : "opacity-0")} aria-hidden />
                        </Link>
                      </th>
                    );
                  })}
                  <th className="hidden xl:table-cell">Team</th>
                  <th className="hidden lg:table-cell">Hours</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((p) => {
                  const st = projectStatus(p.status);
                  const pct = progressOf(p);
                  const late = p.deadline && p.deadline < today && p.status !== "finished" && p.status !== "cancelled";
                  const h = hrs(p.id);
                  return (
                    <tr key={p.id}>
                      <td className="text-xs text-slate-400">{p.id}</td>
                      <td><Link href={`/projects/${p.id}`} className="font-semibold text-slate-900 hover:text-brand-700">{p.name}</Link></td>
                      <td className="hidden text-slate-600 md:table-cell">{p.customer?.company}</td>
                      <td className="hidden text-slate-600 lg:table-cell">{formatDate(p.start_date)}</td>
                      <td className={cn("whitespace-nowrap", late ? "font-semibold text-rose-600" : "text-slate-600")}>{formatDate(p.deadline)}</td>
                      <td className="hidden sm:table-cell">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-20 rounded-full bg-slate-100"><div className="h-1.5 rounded-full bg-brand-500" style={{ width: `${pct}%` }} /></div>
                          <span className="text-xs text-slate-500">{pct}%</span>
                        </div>
                      </td>
                      <td className="hidden xl:table-cell">
                        <div className="flex -space-x-1.5">{p.project_members.slice(0, 4).map((m) => <Avatar key={m.staff_id} name={m.staff?.full_name} className="h-6 w-6 text-[9px] ring-2 ring-white" />)}</div>
                      </td>
                      <td className={cn("hidden whitespace-nowrap lg:table-cell", p.estimated_hours && h > Number(p.estimated_hours) ? "font-semibold text-rose-600" : "text-slate-600")}>
                        {h} h{p.estimated_hours ? ` / ${Number(p.estimated_hours)}` : ""}
                      </td>
                      <td><Badge className={st.color}>{st.label}</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((p) => {
            const s = projectStatus(p.status);
            const pr = prog(p.id);
            const pct = progressOf(p);
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
