import type { Metadata } from "next";
import Link from "next/link";
import { ListChecks, Plus } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { requireStaff } from "@/lib/auth";
import { TASK_STATUSES, taskPriority } from "@/lib/constants";
import type { Enums } from "@/lib/database.types";
import { cn, formatDate, PAGE_SIZE, searchTerm } from "@/lib/utils";
import { CompleteToggle, StatusSelect } from "./status-select";

export const metadata: Metadata = { title: "Tasks" };

type SP = { q?: string; status?: string; scope?: string; due?: string; page?: string };

export default async function TasksPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const { supabase, profile, can } = await requireStaff();
  const canEdit = can("tasks", "edit");
  const today = new Date().toISOString().slice(0, 10);
  const mine = sp.scope !== "all";

  // "Mine" = assigned to me. Use an inner join on assignees so the filter applies to the parent row.
  const assigneeSel = mine
    ? "task_assignees!inner(staff_id, staff:profiles(full_name))"
    : "task_assignees(staff_id, staff:profiles(full_name))";
  let query = supabase
    .from("tasks")
    .select(`id, name, status, priority, start_date, due_date, rel_type, rel_id, ${assigneeSel}`, { count: "exact" })
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("id", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (mine) query = query.eq("task_assignees.staff_id", profile.id);
  const term = sp.q ? searchTerm(sp.q) : "";
  if (term) query = query.ilike("name", `%${term}%`);
  if (sp.status && TASK_STATUSES.some((s) => s.value === sp.status)) query = query.eq("status", sp.status as Enums<"task_status">);
  else if (!sp.status) query = query.neq("status", "complete");
  if (sp.due === "overdue") query = query.lt("due_date", today).neq("status", "complete");
  if (sp.due === "today") query = query.eq("due_date", today);

  const { data: tasks, count } = await query;

  // Status summary for the current scope
  const { data: summaryRows } = mine
    ? await supabase.from("tasks").select("status, task_assignees!inner(staff_id)").eq("task_assignees.staff_id", profile.id)
    : await supabase.from("tasks").select("status");
  const counts = new Map<string, number>();
  for (const r of summaryRows ?? []) counts.set(r.status, (counts.get(r.status) ?? 0) + 1);

  // Resolve related record names in two batched queries
  const custIds = [...new Set((tasks ?? []).filter((t) => t.rel_type === "customer").map((t) => t.rel_id!))];
  const leadIds = [...new Set((tasks ?? []).filter((t) => t.rel_type === "lead").map((t) => t.rel_id!))];
  const projIds = [...new Set((tasks ?? []).filter((t) => t.rel_type === "project").map((t) => t.rel_id!))];
  const [{ data: custs }, { data: lds }, { data: projs }] = await Promise.all([
    custIds.length ? supabase.from("customers").select("id, company").in("id", custIds) : Promise.resolve({ data: [] as { id: number; company: string }[] }),
    leadIds.length ? supabase.from("leads").select("id, name").in("id", leadIds) : Promise.resolve({ data: [] as { id: number; name: string }[] }),
    projIds.length ? supabase.from("projects").select("id, name").in("id", projIds) : Promise.resolve({ data: [] as { id: number; name: string }[] }),
  ]);
  const relName = (t: { rel_type: string | null; rel_id: number | null }) =>
    t.rel_type === "customer"
      ? custs?.find((c) => c.id === t.rel_id)?.company
      : t.rel_type === "lead"
        ? lds?.find((l) => l.id === t.rel_id)?.name
        : t.rel_type === "project"
          ? projs?.find((p) => p.id === t.rel_id)?.name
          : undefined;

  const href = (patch: Partial<SP>) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...patch, page: undefined })) if (v) next.set(k, v);
    const qs = next.toString();
    return qs ? `/tasks?${qs}` : "/tasks";
  };
  const pill = (active: boolean) =>
    cn("rounded-full px-3 py-1 text-xs font-medium", active ? "bg-ink-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50");

  return (
    <>
      <PageHeader
        title="Tasks"
        description={mine ? "Everything assigned to you." : "Everything across the team."}
        actions={canEdit && <LinkButton href="/tasks/new"><Plus className="h-4 w-4" /> New task</LinkButton>}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {TASK_STATUSES.map((s) => (
          <Link key={s.value} href={href({ status: sp.status === s.value ? undefined : s.value })}>
            <Card className={cn("px-4 py-3 transition hover:border-brand-200", sp.status === s.value && "border-brand-400 ring-2 ring-brand-100")}>
              <div className="text-2xl font-bold text-slate-900">{counts.get(s.value) ?? 0}</div>
              <div className="text-xs font-medium text-slate-500">{s.label}</div>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-1.5">
            <Link href={href({ scope: undefined })} className={pill(mine)}>My tasks</Link>
            <Link href={href({ scope: "all" })} className={pill(!mine)}>All tasks</Link>
            <span className="mx-1 h-5 w-px bg-slate-200" />
            <Link href={href({ due: sp.due === "today" ? undefined : "today" })} className={pill(sp.due === "today")}>Due today</Link>
            <Link href={href({ due: sp.due === "overdue" ? undefined : "overdue" })} className={pill(sp.due === "overdue")}>Overdue</Link>
          </div>
          <SearchInput placeholder="Search tasks…" />
        </div>

        {!tasks?.length ? (
          <EmptyState icon={ListChecks} title="Nothing here" description={sp.status ? "No tasks with this status." : "You're all caught up."} action={canEdit && <LinkButton href="/tasks/new"><Plus className="h-4 w-4" /> New task</LinkButton>} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th className="w-10" />
                    <th>Task</th>
                    <th className="hidden md:table-cell">Related to</th>
                    <th className="hidden lg:table-cell">Assignees</th>
                    <th>Priority</th>
                    <th>Due</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((t) => {
                    const p = taskPriority(t.priority);
                    const overdue = t.status !== "complete" && t.due_date && t.due_date < today;
                    const rn = relName(t);
                    return (
                      <tr key={t.id}>
                        <td><CompleteToggle id={t.id} done={t.status === "complete"} /></td>
                        <td>
                          <Link href={`/tasks/${t.id}`} className={cn("font-medium text-slate-900 hover:text-brand-700", t.status === "complete" && "text-slate-400 line-through")}>
                            {t.name}
                          </Link>
                        </td>
                        <td className="hidden md:table-cell">
                          {rn ? (
                            <Link href={`/${t.rel_type}s/${t.rel_id}`} className="text-slate-600 hover:text-brand-700">
                              <span className="mr-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-500">{t.rel_type}</span>
                              {rn}
                            </Link>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="hidden lg:table-cell">
                          <div className="flex -space-x-1.5">
                            {t.task_assignees.map((a) => (
                              <Avatar key={a.staff_id} name={a.staff?.full_name} className="h-7 w-7 text-[10px] ring-2 ring-white" />
                            ))}
                          </div>
                        </td>
                        <td><span className={cn("text-xs font-semibold", p.color)}>{p.label}</span></td>
                        <td className={cn("whitespace-nowrap", overdue ? "font-semibold text-rose-600" : "text-slate-600")}>{formatDate(t.due_date)}</td>
                        <td><StatusSelect id={t.id} status={t.status} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pageSize={PAGE_SIZE} total={count ?? 0} basePath="/tasks" params={{ q: sp.q, status: sp.status, scope: sp.scope, due: sp.due }} />
          </>
        )}
      </Card>
    </>
  );
}
