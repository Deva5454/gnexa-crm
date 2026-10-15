import type { Metadata } from "next";
import { allTags, idsWithTag, tagsFor } from "@/components/crm/tags";
import { TagChip } from "@/components/crm/tag-editor";
import { TagFilter } from "@/components/crm/tag-filter";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LifeBuoy, MessageSquare, Plus } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SearchInput } from "@/components/ui/search-input";
import { requireStaff } from "@/lib/auth";
import { TICKET_STATUSES, taskPriority, ticketNumber, ticketStatus } from "@/lib/constants";
import { cn, searchTerm, timeAgo } from "@/lib/utils";

export const metadata: Metadata = { title: "Support" };

type SP = { q?: string; status?: string; view?: string; dept?: string; tag?: string };

export default async function SupportPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const { supabase, can, profile } = await requireStaff();
  if (!can("support", "view")) notFound();

  let q = supabase
    .from("tickets")
    .select("id, subject, priority, status, last_reply_at, assigned_to, customer:customers(company), department:ticket_departments(name), assignee:profiles!tickets_assigned_to_fkey(full_name), ticket_replies(count)")
    .order("last_reply_at", { ascending: false })
    .limit(500);
  const term = sp.q ? searchTerm(sp.q) : "";
  if (term) q = q.ilike("subject", `%${term}%`);
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

  const [{ data: tickets }, { data: all }, { data: depts }, tagList, { count: myDeptCount }] = await Promise.all([
    q,
    supabase.from("tickets").select("status, priority, assigned_to"),
    supabase.from("ticket_departments").select("id, name").order("name"),
    allTags(supabase),
    supabase.from("staff_departments").select("department_id", { count: "exact", head: true }).eq("staff_id", profile.id),
  ]);
  const tagMap = await tagsFor(supabase, "ticket", (tickets ?? []).map((t) => t.id));
  const counts = new Map<string, number>();
  for (const t of all ?? []) counts.set(t.status, (counts.get(t.status) ?? 0) + 1);
  const urgentOpen = (all ?? []).filter((t) => t.status !== "closed" && (t.priority === "urgent" || t.priority === "high")).length;
  const unassigned = (all ?? []).filter((t) => t.status !== "closed" && !t.assigned_to).length;

  const href = (patch: Partial<SP>) => {
    const n = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...patch })) if (v) n.set(k, v);
    const s = n.toString();
    return s ? `/support?${s}` : "/support";
  };
  const pill = (a: boolean) => cn("rounded-full px-3 py-1 text-xs font-medium", a ? "bg-ink-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50");

  return (
    <>
      <PageHeader
        title="Support"
        description={`${urgentOpen} high-priority open · ${unassigned} unassigned`}
        actions={can("support", "edit") && <LinkButton href="/support/new"><Plus className="h-4 w-4" /> New ticket</LinkButton>}
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
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-1.5">
            <Link href={href({ view: undefined, status: undefined })} className={pill(!sp.view && !sp.status)}>Not closed</Link>
            <Link href={href({ view: "mine" })} className={pill(sp.view === "mine")}>Assigned to me</Link>
            <Link href={href({ view: "unassigned" })} className={pill(sp.view === "unassigned")}>Unassigned</Link>
            {(myDeptCount ?? 0) > 0 && <Link href={href({ view: "my_depts" })} className={pill(sp.view === "my_depts")}>My departments</Link>}
            {tagList.length > 0 && <TagFilter tags={tagList} />}
            <span className="mx-1 h-5 w-px bg-slate-200" />
            {depts?.map((d) => <Link key={d.id} href={href({ dept: sp.dept === String(d.id) ? undefined : String(d.id) })} className={pill(sp.dept === String(d.id))}>{d.name}</Link>)}
          </div>
          <SearchInput placeholder="Search tickets…" />
        </div>
        {!tickets?.length ? (
          <EmptyState icon={LifeBuoy} title="No tickets here" description="All caught up." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {tickets.map((t) => {
              const st = ticketStatus(t.status);
              const pr = taskPriority(t.priority);
              const replies = (t.ticket_replies as unknown as { count: number }[] | undefined)?.[0]?.count ?? 0;
              return (
                <li key={t.id}>
                  <Link href={`/support/${t.id}`} className="flex items-center gap-4 px-5 py-4 hover:bg-brand-50/30">
                    <span className={cn("h-10 w-1 shrink-0 rounded-full", t.priority === "urgent" ? "bg-rose-500" : t.priority === "high" ? "bg-orange-400" : t.priority === "medium" ? "bg-sky-400" : "bg-slate-300")} title={`${pr.label} priority`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="truncate font-semibold text-slate-900">{t.subject}</span>
                        {(tagMap.get(t.id) ?? []).map((g) => <TagChip key={g.id} tag={g} className="px-1.5 text-[10px]" />)}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                        <span className="font-mono">{ticketNumber(t.id)}</span>
                        {t.customer && <span>· {t.customer.company}</span>}
                        {t.department && <span>· {t.department.name}</span>}
                      </div>
                    </div>
                    <span className="hidden items-center gap-1 text-xs text-slate-400 sm:flex"><MessageSquare className="h-3.5 w-3.5" />{replies}</span>
                    <span className="hidden w-28 text-right text-xs text-slate-500 md:block" suppressHydrationWarning>{timeAgo(t.last_reply_at)}</span>
                    <span className="hidden w-32 lg:block">
                      {t.assignee ? <span className="flex items-center gap-2 text-xs text-slate-600"><Avatar name={t.assignee.full_name} className="h-6 w-6 text-[9px]" />{t.assignee.full_name}</span> : <span className="text-xs text-amber-600">Unassigned</span>}
                    </span>
                    <Badge className={st.color}>{st.label}</Badge>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
