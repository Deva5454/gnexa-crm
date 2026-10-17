import type { Metadata } from "next";
import { allTags, idsWithTag, tagsFor } from "@/components/crm/tags";
import { TagChip } from "@/components/crm/tag-editor";
import { TagFilter } from "@/components/crm/tag-filter";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, LifeBuoy, MessageSquare, Paperclip, Plus } from "lucide-react";
import { BulkBar, SelectAll } from "@/components/crm/bulk-bar";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ParamSelect } from "@/components/ui/param-select";
import { SearchInput } from "@/components/ui/search-input";
import { requireStaff } from "@/lib/auth";
import { TASK_PRIORITIES, TICKET_STATUSES, taskPriority, ticketNumber, ticketStatus } from "@/lib/constants";
import { cn, searchTerm, timeAgo } from "@/lib/utils";
import { allRows } from "@/lib/fetch-all";
import { bulkTickets } from "./actions";

export const metadata: Metadata = { title: "Support" };

type SP = { q?: string; status?: string; view?: string; dept?: string; tag?: string; priority?: string; staff?: string; service?: string; customer?: string };

export default async function SupportPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const { supabase, can, profile } = await requireStaff();
  if (!can("support", "view")) notFound();
  const canEdit = can("support", "edit");

  let q = supabase
    .from("tickets")
    .select(
      "id, subject, priority, status, last_reply_at, created_at, assigned_to, customer_id, customer:customers(company), contact:contacts(first_name, last_name), department:ticket_departments(name), service:ticket_services(name), assignee:profiles!tickets_assigned_to_fkey(full_name), ticket_replies(count), ticket_files(count)",
    )
    .order("last_reply_at", { ascending: false })
    .limit(500);
  const term = sp.q ? searchTerm(sp.q) : "";
  if (term) q = /^\d+$/.test(term) || /^tkt-?\d+$/i.test(term) ? q.eq("id", Number(term.replace(/\D/g, ""))) : q.ilike("subject", `%${term}%`);
  if (sp.status) q = q.eq("status", sp.status);
  else if (!sp.view) q = q.neq("status", "closed");
  if (sp.view === "mine") q = q.eq("assigned_to", profile.id);
  if (sp.view === "unassigned") q = q.is("assigned_to", null);
  if (sp.view === "my_depts") {
    const { data: md } = await supabase.from("staff_departments").select("department_id").eq("staff_id", profile.id);
    q = q.in("department_id", md?.length ? md.map((d) => d.department_id) : [0]);
  }
  if (Number(sp.tag)) {
    const ids = await idsWithTag(supabase, "ticket", Number(sp.tag));
    q = q.in("id", ids.length ? ids : [0]);
  }
  if (sp.dept) q = q.eq("department_id", Number(sp.dept));
  if (sp.priority && TASK_PRIORITIES.some((p) => p.value === sp.priority)) q = q.eq("priority", sp.priority);
  if (sp.staff && /^[0-9a-f-]{36}$/i.test(sp.staff)) q = q.eq("assigned_to", sp.staff);
  if (Number(sp.service)) q = q.eq("service_id", Number(sp.service));
  if (Number(sp.customer)) q = q.eq("customer_id", Number(sp.customer));

  const [{ data: tickets }, { data: all }, { data: depts }, { data: services }, { data: staff }, tagList, { count: myDeptCount }] = await Promise.all([
    q,
    allRows((a, b) => supabase.from("tickets").select("status, priority, assigned_to").order("id").range(a, b)),
    supabase.from("ticket_departments").select("id, name").order("name"),
    supabase.from("ticket_services").select("id, name").order("name"),
    supabase.from("profiles").select("id, full_name").eq("is_active", true).order("full_name"),
    allTags(supabase),
    supabase.from("staff_departments").select("department_id", { count: "exact", head: true }).eq("staff_id", profile.id),
  ]);
  const tagMap = await tagsFor(supabase, "ticket", (tickets ?? []).map((t) => t.id));
  const counts = new Map<string, number>();
  for (const t of all ?? []) counts.set(t.status, (counts.get(t.status) ?? 0) + 1);
  const urgentOpen = (all ?? []).filter((t) => t.status !== "closed" && (t.priority === "urgent" || t.priority === "high")).length;
  const unassigned = (all ?? []).filter((t) => t.status !== "closed" && !t.assigned_to).length;
  const customerName = Number(sp.customer) ? (tickets ?? []).find((t) => t.customer_id === Number(sp.customer))?.customer?.company : null;

  const href = (patch: Partial<SP>) => {
    const n = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...patch })) if (v) n.set(k, v);
    const s = n.toString();
    return s ? `/support?${s}` : "/support";
  };
  const pill = (a: boolean) => cn("rounded-full px-3 py-1 text-xs font-medium", a ? "bg-ink-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50");
  const opt = (rows: { id: number; name: string }[] | null) => (rows ?? []).map((r) => ({ value: String(r.id), label: r.name }));
  const staffOpts = (staff ?? []).map((s) => ({ value: s.id, label: s.full_name }));
  const count = (x: unknown) => (x as { count: number }[] | undefined)?.[0]?.count ?? 0;

  return (
    <>
      <PageHeader
        title="Support"
        description={`${urgentOpen} high-priority open · ${unassigned} unassigned`}
        actions={
          <>
            <LinkButton href="/csv-export/tickets" variant="secondary"><Download className="h-4 w-4" /> Export</LinkButton>
            {canEdit && <LinkButton href="/support/new"><Plus className="h-4 w-4" /> New ticket</LinkButton>}
          </>
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {TICKET_STATUSES.map((s) => (
          <Link key={s.value} href={href({ status: sp.status === s.value ? undefined : s.value, view: sp.view })}>
            <Card className={cn("px-4 py-3 transition hover:border-brand-200", sp.status === s.value && "border-brand-400 ring-2 ring-brand-100")}>
              <div className="text-2xl font-bold text-slate-900">{counts.get(s.value) ?? 0}</div>
              <div className="text-xs font-medium text-slate-500">{s.label}</div>
            </Card>
          </Link>
        ))}
      </div>
      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex flex-wrap items-center gap-1.5">
            <Link href={href({ view: undefined, status: undefined })} className={pill(!sp.view && !sp.status)}>Not closed</Link>
            <Link href={href({ view: "all", status: undefined })} className={pill(sp.view === "all")}>All</Link>
            <Link href={href({ view: "mine" })} className={pill(sp.view === "mine")}>Assigned to me</Link>
            <Link href={href({ view: "unassigned" })} className={pill(sp.view === "unassigned")}>Unassigned</Link>
            {(myDeptCount ?? 0) > 0 && <Link href={href({ view: "my_depts" })} className={pill(sp.view === "my_depts")}>My departments</Link>}
            <span className="mx-1 h-5 w-px bg-slate-200" />
            <ParamSelect name="dept" label="Department" allLabel="Any department" options={opt(depts)} />
            {(services ?? []).length > 0 && <ParamSelect name="service" label="Service" allLabel="Any service" options={opt(services)} />}
            <ParamSelect name="priority" label="Priority" allLabel="Any priority" options={TASK_PRIORITIES.map((p) => ({ value: p.value, label: p.label }))} />
            <ParamSelect name="staff" label="Assigned to" allLabel="Any assignee" options={staffOpts} />
            {tagList.length > 0 && <TagFilter tags={tagList} />}
            {customerName && <Link href={href({ customer: undefined })} className={pill(true)}>{customerName} ×</Link>}
          </div>
          <SearchInput placeholder="Search subject or ticket #…" />
        </div>
        {!tickets?.length ? (
          <EmptyState icon={LifeBuoy} title="No tickets here" description="All caught up." />
        ) : (
          <>
            {canEdit && (
              <BulkBar
                id="ticket-bulk"
                action={bulkTickets}
                noun="ticket"
                ops={[
                  { value: "status", label: "Change status", target: { label: "Status", options: TICKET_STATUSES.map((s) => ({ value: s.value, label: s.label })) } },
                  { value: "priority", label: "Change priority", target: { label: "Priority", options: TASK_PRIORITIES.map((p) => ({ value: p.value, label: p.label })) } },
                  { value: "assign", label: "Assign to", target: { label: "Staff", options: [{ value: "none", label: "— Unassigned —" }, ...staffOpts] } },
                  { value: "department", label: "Move to department", target: { label: "Department", options: opt(depts) } },
                  ...((services ?? []).length ? [{ value: "service", label: "Set service", target: { label: "Service", options: opt(services) } }] : []),
                  ...(tagList.length ? [{ value: "tag", label: "Add tag", target: { label: "Tag", options: tagList.map((g) => ({ value: String(g.id), label: g.name })) } }] : []),
                  { value: "merge", label: "Merge into the oldest selected" },
                  ...(can("support", "full") ? [{ value: "delete", label: "Delete", danger: true }] : []),
                ]}
              />
            )}
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    {canEdit && <th className="w-8"><SelectAll form="ticket-bulk" label="Select all tickets shown" /></th>}
                    <th>Ticket</th>
                    <th className="hidden md:table-cell">Customer</th>
                    <th className="hidden xl:table-cell">Department / service</th>
                    <th className="hidden lg:table-cell">Assigned</th>
                    <th>Priority</th>
                    <th className="hidden sm:table-cell">Last reply</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((t) => {
                    const st = ticketStatus(t.status);
                    const pr = taskPriority(t.priority);
                    const contact = t.contact ? [t.contact.first_name, t.contact.last_name].filter(Boolean).join(" ") : null;
                    return (
                      <tr key={t.id}>
                        {canEdit && <td><input type="checkbox" name="ids" value={t.id} form="ticket-bulk" aria-label={`Select ${ticketNumber(t.id)}`} className="h-4 w-4 rounded border-slate-300 text-brand-600" /></td>}
                        <td className="max-w-md">
                          <Link href={`/support/${t.id}`} className="font-medium text-slate-900 hover:text-brand-700">{t.subject}</Link>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                            <span className="font-mono">{ticketNumber(t.id)}</span>
                            <span className="inline-flex items-center gap-0.5"><MessageSquare className="h-3 w-3" />{count(t.ticket_replies)}</span>
                            {count(t.ticket_files) > 0 && <span className="inline-flex items-center gap-0.5"><Paperclip className="h-3 w-3" />{count(t.ticket_files)}</span>}
                            {(tagMap.get(t.id) ?? []).map((g) => <TagChip key={g.id} tag={g} className="px-1.5 text-[10px]" />)}
                          </div>
                        </td>
                        <td className="hidden md:table-cell">
                          {t.customer ? <Link href={href({ customer: String(t.customer_id) })} className="text-slate-700 hover:text-brand-700">{t.customer.company}</Link> : <span className="text-slate-400">—</span>}
                          {contact && <div className="text-xs text-slate-500">{contact}</div>}
                        </td>
                        <td className="hidden text-slate-600 xl:table-cell">
                          {t.department?.name ?? "—"}
                          {t.service && <div className="text-xs text-slate-500">{t.service.name}</div>}
                        </td>
                        <td className="hidden lg:table-cell">
                          {t.assignee ? <span className="flex items-center gap-2 text-xs text-slate-600"><Avatar name={t.assignee.full_name} className="h-6 w-6 text-[9px]" />{t.assignee.full_name}</span> : <span className="text-xs text-amber-600">Unassigned</span>}
                        </td>
                        <td><span className={cn("text-xs font-semibold", pr.color)}>{pr.label}</span></td>
                        <td className="hidden whitespace-nowrap text-xs text-slate-500 sm:table-cell" suppressHydrationWarning>{timeAgo(t.last_reply_at)}</td>
                        <td><Badge className={st.color}>{st.label}</Badge></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
    </>
  );
}
