import type { Metadata } from "next";
import Link from "next/link";
import { Columns3, Download, List, ListChecks, Plus, Repeat } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { requireStaff } from "@/lib/auth";
import { TASK_PRIORITIES, TASK_STATUSES, taskPriority } from "@/lib/constants";
import type { Enums } from "@/lib/database.types";
import { cn, formatDate, PAGE_SIZE, searchTerm } from "@/lib/utils";
import { allTags, idsWithTag, tagsFor } from "@/components/crm/tags";
import { TagChip } from "@/components/crm/tag-editor";
import { CompleteToggle, StatusSelect } from "./status-select";
import { TasksBoard, type BoardTask } from "./kanban";
import { TagFilter } from "@/components/crm/tag-filter";
import { allRows } from "@/lib/fetch-all";
import { daysFromToday, todayIST } from "@/lib/dates";
import { BulkBar, SelectAll } from "@/components/crm/bulk-bar";
import { ParamSelect } from "@/components/ui/param-select";
import { isTaskRelType, resolveTaskRels, TASK_REL_LABELS, TASK_REL_TYPES } from "@/lib/task-links";
import { bulkTasks } from "./actions";

export const metadata: Metadata = { title: "Tasks" };

type SP = { q?: string; status?: string; scope?: string; due?: string; page?: string; view?: string; tag?: string; staff?: string; priority?: string; rel?: string };

export default async function TasksPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const { supabase, profile, can } = await requireStaff();
  const canEdit = can("tasks", "edit");
  const today = todayIST();
  // Picking a staff member (or "not assigned") looks across the team
  const staffFilter = sp.staff === "none" ? "none" : sp.staff && /^[0-9a-f-]{36}$/i.test(sp.staff) ? sp.staff : null;
  const mine = sp.scope !== "all" && !staffFilter;
  const assigneeId = staffFilter && staffFilter !== "none" ? staffFilter : mine ? profile.id : null;
  const board = sp.view === "board";
  const tagId = Number(sp.tag) || null;
  const tagged = tagId ? await idsWithTag(supabase, "task", tagId) : null;

  // "Mine" = assigned to me. Use an inner join on assignees so the filter applies to the parent row.
  const assigneeSel = assigneeId
    ? "task_assignees!inner(staff_id, staff:profiles(full_name))"
    : "task_assignees(staff_id, staff:profiles(full_name))";
  let query = supabase
    .from("tasks")
    .select(`id, name, status, priority, start_date, due_date, rel_type, rel_id, recurring_every, ${assigneeSel}`, { count: "exact" })
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("id", { ascending: false })
    .range(board ? 0 : (page - 1) * PAGE_SIZE, board ? 299 : page * PAGE_SIZE - 1);
  if (tagged) query = query.in("id", tagged.length ? tagged : [0]);
  if (assigneeId) query = query.eq("task_assignees.staff_id", assigneeId);
  if (staffFilter === "none") query = query.is("task_assignees", null);
  if (sp.priority && TASK_PRIORITIES.some((p) => p.value === sp.priority)) query = query.eq("priority", sp.priority as Enums<"task_priority">);
  if (sp.rel === "none") query = query.is("rel_type", null);
  else if (isTaskRelType(sp.rel)) query = query.eq("rel_type", sp.rel);
  const term = sp.q ? searchTerm(sp.q) : "";
  if (term) query = query.ilike("name", `%${term}%`);
  if (board) {
    // The board shows every column; keep finished work to the last fortnight so it stays readable
    query = query.or(`status.neq.complete,completed_at.gte.${new Date(Date.now() - 14 * 86400_000).toISOString()}`);
  } else if (sp.status && TASK_STATUSES.some((s) => s.value === sp.status)) query = query.eq("status", sp.status as Enums<"task_status">);
  else if (!sp.status) query = query.neq("status", "complete");
  if (sp.due === "overdue") query = query.lt("due_date", today).neq("status", "complete");
  if (sp.due === "today") query = query.eq("due_date", today);
  if (sp.due === "week") query = query.gte("due_date", today).lte("due_date", daysFromToday(7));
  if (sp.due === "recurring") query = query.not("recurring_every", "is", null);

  const { data: tasks, count } = await query;
  const ids = (tasks ?? []).map((t) => t.id);
  const [tagMap, tagList, relOf, { data: staffList }, boardExtras] = await Promise.all([
    tagsFor(supabase, "task", ids),
    allTags(supabase),
    resolveTaskRels(supabase, tasks ?? []),
    supabase.from("profiles").select("id, full_name").eq("is_active", true).order("full_name"),
    board && ids.length
      ? Promise.all([
          supabase.from("task_checklist_items").select("task_id, is_done").in("task_id", ids),
          supabase.from("task_comments").select("task_id").in("task_id", ids),
        ])
      : Promise.resolve(null),
  ]);

  // Status summary for the current scope
  const { data: summaryRows } = mine
    ? await allRows((a, b) => supabase.from("tasks").select("status, task_assignees!inner(staff_id)").eq("task_assignees.staff_id", profile.id).order("id").range(a, b))
    : await allRows((a, b) => supabase.from("tasks").select("status").order("id").range(a, b));
  const counts = new Map<string, number>();
  for (const r of summaryRows ?? []) counts.set(r.status, (counts.get(r.status) ?? 0) + 1);

  const relName = (t: { rel_type: string | null; rel_id: number | null }) => relOf(t)?.label;

  const href = (patch: Partial<SP>) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...patch, page: undefined })) if (v) next.set(k, v);
    const qs = next.toString();
    return qs ? `/tasks?${qs}` : "/tasks";
  };
  const boardTasks: BoardTask[] = board
    ? (tasks ?? []).map((t) => {
        const cl = boardExtras?.[0].data?.filter((c) => c.task_id === t.id) ?? [];
        return {
          id: t.id,
          name: t.name,
          status: t.status,
          priority: t.priority,
          due_date: t.due_date,
          rel: relName(t) ?? null,
          assignees: t.task_assignees.map((a) => a.staff?.full_name ?? "?"),
          tags: tagMap.get(t.id) ?? [],
          checklist: [cl.filter((c) => c.is_done).length, cl.length],
          comments: boardExtras?.[1].data?.filter((c) => c.task_id === t.id).length ?? 0,
        };
      })
    : [];

  const pill = (active: boolean) =>
    cn("rounded-full px-3 py-1 text-xs font-medium", active ? "bg-ink-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50");

  return (
    <>
      <PageHeader
        title="Tasks"
        description={mine ? "Everything assigned to you." : "Everything across the team."}
        actions={
          <>
            <div className="flex rounded-lg bg-slate-100 p-0.5">
              <Link href={href({ view: undefined })} className={cn("flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold", !board ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800")}>
                <List className="h-3.5 w-3.5" /> List
              </Link>
              <Link href={href({ view: "board", status: undefined })} className={cn("flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold", board ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800")}>
                <Columns3 className="h-3.5 w-3.5" /> Board
              </Link>
            </div>
            {can("tasks", "view") && <LinkButton href="/csv-export/tasks" variant="secondary"><Download className="h-4 w-4" /> Export</LinkButton>}
            {canEdit && <LinkButton href="/tasks/new"><Plus className="h-4 w-4" /> New task</LinkButton>}
          </>
        }
      />

      {!board && (
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
      )}

      <Card className={cn(board && "mb-5")}>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-1.5">
            <Link href={href({ scope: undefined, staff: undefined })} className={pill(mine)}>My tasks</Link>
            <Link href={href({ scope: "all", staff: undefined })} className={pill(!mine && !staffFilter)}>All tasks</Link>
            <span className="mx-1 h-5 w-px bg-slate-200" />
            <Link href={href({ due: sp.due === "today" ? undefined : "today" })} className={pill(sp.due === "today")}>Due today</Link>
            <Link href={href({ due: sp.due === "overdue" ? undefined : "overdue" })} className={pill(sp.due === "overdue")}>Overdue</Link>
            <Link href={href({ due: sp.due === "week" ? undefined : "week" })} className={pill(sp.due === "week")}>Due this week</Link>
            <Link href={href({ due: sp.due === "recurring" ? undefined : "recurring" })} className={pill(sp.due === "recurring")}>Recurring</Link>
            <span className="mx-1 h-5 w-px bg-slate-200" />
            <ParamSelect name="staff" label="Assigned to" allLabel="Any assignee" options={[{ value: "none", label: "Not assigned" }, ...(staffList ?? []).map((x) => ({ value: x.id, label: x.full_name }))]} />
            <ParamSelect name="priority" label="Priority" allLabel="Any priority" options={TASK_PRIORITIES.map((p) => ({ value: p.value, label: p.label }))} />
            <ParamSelect name="rel" label="Related to" allLabel="Any link" options={[{ value: "none", label: "Not linked" }, ...TASK_REL_TYPES.map((r) => ({ value: r, label: TASK_REL_LABELS[r] }))]} />
            {tagList.length > 0 && <TagFilter tags={tagList} />}
          </div>
          <SearchInput placeholder="Search tasks…" />
        </div>

        {board ? null : !tasks?.length ? (
          <EmptyState icon={ListChecks} title="Nothing here" description={sp.status ? "No tasks with this status." : "You're all caught up."} action={canEdit && <LinkButton href="/tasks/new"><Plus className="h-4 w-4" /> New task</LinkButton>} />
        ) : (
          <>
            {canEdit && (
              <BulkBar
                id="task-bulk"
                action={bulkTasks}
                noun="task"
                ops={[
                  { value: "status", label: "Change status", target: { label: "Status", options: TASK_STATUSES.map((x) => ({ value: x.value, label: x.label })) } },
                  { value: "priority", label: "Change priority", target: { label: "Priority", options: TASK_PRIORITIES.map((x) => ({ value: x.value, label: x.label })) } },
                  { value: "assign", label: "Add assignee", target: { label: "Staff", options: (staffList ?? []).map((x) => ({ value: x.id, label: x.full_name })) } },
                  ...(tagList.length ? [{ value: "tag", label: "Add tag", target: { label: "Tag", options: tagList.map((g) => ({ value: String(g.id), label: g.name })) } }] : []),
                  ...(can("tasks", "full") ? [{ value: "delete", label: "Delete", danger: true }] : []),
                ]}
              />
            )}
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    {canEdit && <th className="w-8"><SelectAll form="task-bulk" label="Select all tasks on this page" /></th>}
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
                    const rn = relOf(t);
                    return (
                      <tr key={t.id}>
                        {canEdit && <td><input type="checkbox" name="ids" value={t.id} form="task-bulk" aria-label={`Select ${t.name}`} className="h-4 w-4 rounded border-slate-300 text-brand-600" /></td>}
                        <td><CompleteToggle id={t.id} done={t.status === "complete"} /></td>
                        <td>
                          <Link href={`/tasks/${t.id}`} className={cn("font-medium text-slate-900 hover:text-brand-700", t.status === "complete" && "text-slate-400 line-through")}>
                            {t.name}
                          </Link>
                          {t.recurring_every && <Repeat className="ml-1.5 inline h-3.5 w-3.5 text-slate-400" aria-label="Recurring" />}
                          {(tagMap.get(t.id) ?? []).length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">{tagMap.get(t.id)!.map((g) => <TagChip key={g.id} tag={g} className="px-1.5 text-[10px]" />)}</div>
                          )}
                        </td>
                        <td className="hidden md:table-cell">
                          {rn ? (
                            <Link href={rn.href} className="text-slate-600 hover:text-brand-700">
                              <span className="mr-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-500">{rn.kind}</span>
                              {rn.label}
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
            <Pagination page={page} pageSize={PAGE_SIZE} total={count ?? 0} basePath="/tasks" params={{ q: sp.q, status: sp.status, scope: sp.scope, due: sp.due, tag: sp.tag, staff: sp.staff, priority: sp.priority, rel: sp.rel }} />
          </>
        )}
      </Card>
      {board && <TasksBoard tasks={boardTasks} canEdit={canEdit} today={today} />}
    </>
  );
}
