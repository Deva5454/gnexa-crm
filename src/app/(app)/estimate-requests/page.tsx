import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Columns3, Download, Inbox, List } from "lucide-react";
import { BulkBar, SelectAll } from "@/components/crm/bulk-bar";
import { ColorBadge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { ParamSelect } from "@/components/ui/param-select";
import { SearchInput } from "@/components/ui/search-input";
import { requireFeature, requireStaff } from "@/lib/auth";
import { cn, PAGE_SIZE, searchTerm, timeAgo } from "@/lib/utils";
import { bulkEstimateRequests } from "./actions";
import { RequestBoard } from "./board";
import { reqStatuses } from "./status";

export const metadata: Metadata = { title: "Estimate requests" };

type SP = { status?: string; view?: string; assigned?: string; form?: string; q?: string; sort?: string; page?: string };

const SORTS = [
  { value: "oldest", label: "Oldest first" },
  { value: "name", label: "Name A–Z" },
];

export default async function EstimateRequestsPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireFeature("estimate_requests"); // Setup → Modules
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const { supabase, can, profile } = await requireStaff();
  if (!can("sales", "view")) notFound();
  const canEdit = can("sales", "edit");
  const board = sp.view === "board";
  const statuses = await reqStatuses(supabase);
  const isOpen = (key: string) => statuses.of(key).is_open;

  const term = sp.q ? searchTerm(sp.q) : "";
  let query = supabase
    .from("estimate_requests")
    .select("id, name, company, email, phone, message, budget, status, assigned_to, created_at, assignee:profiles!estimate_requests_assigned_to_fkey(full_name), form:web_forms(name)")
    .order("created_at", { ascending: false })
    .limit(2000);
  if (term) query = query.or(`name.ilike.%${term}%,company.ilike.%${term}%,email.ilike.%${term}%,message.ilike.%${term}%`);
  if (sp.assigned === "me") query = query.eq("assigned_to", profile.id);
  else if (sp.assigned === "none") query = query.is("assigned_to", null);
  else if (sp.assigned) query = query.eq("assigned_to", sp.assigned);
  if (Number(sp.form)) query = query.eq("form_id", Number(sp.form));

  const [{ data: all }, { data: staff }, { data: forms }] = await Promise.all([
    query,
    supabase.from("profiles").select("id, full_name").eq("is_active", true).order("full_name"),
    supabase.from("web_forms").select("id, name").order("name"),
  ]);
  const matched = all ?? [];
  // List: "Open" (statuses marked open) unless a status chip is picked; the board shows every status
  const byStatus = board ? matched : matched.filter((r) => (sp.status === "all" ? true : sp.status ? r.status === sp.status : isOpen(r.status)));
  const sorted = [...byStatus].sort((a, b) =>
    sp.sort === "oldest" ? a.created_at.localeCompare(b.created_at) : sp.sort === "name" ? a.name.localeCompare(b.name) : b.created_at.localeCompare(a.created_at),
  );
  const rows = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const count = (s: string) => matched.filter((r) => r.status === s).length;

  const link = (patch: Partial<SP>) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...patch, page: undefined })) if (v) next.set(k, v);
    const qs = next.toString();
    return qs ? `/estimate-requests?${qs}` : "/estimate-requests";
  };
  const pill = (on: boolean) => cn("rounded-full px-3 py-1 text-xs font-medium", on ? "bg-ink-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50");
  const staffOpts = (staff ?? []).map((s) => ({ value: s.id, label: s.full_name }));
  const filtered = Boolean(term || sp.assigned || sp.form);

  return (
    <>
      <PageHeader
        title="Estimate requests"
        description="Quote requests from your website's “Request a quote” form."
        actions={
          <>
            <LinkButton href="/csv-export/estimate_requests" variant="secondary"><Download className="h-4 w-4" /> Export</LinkButton>
            {profile.is_admin && <LinkButton href="/settings/web-forms" variant="secondary">Manage forms</LinkButton>}
          </>
        }
      />
      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="mr-1 flex rounded-lg bg-white p-0.5 ring-1 ring-slate-200">
              <Link href={link({ view: undefined })} className={cn("flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium", !board ? "bg-brand-600 text-white" : "text-slate-600")}>
                <List className="h-3.5 w-3.5" /> List
              </Link>
              <Link href={link({ view: "board", status: undefined, sort: undefined })} className={cn("flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium", board ? "bg-brand-600 text-white" : "text-slate-600")}>
                <Columns3 className="h-3.5 w-3.5" /> Board
              </Link>
            </div>
            <ParamSelect name="assigned" label="Assigned to" allLabel="Anyone" options={[{ value: "me", label: "Me" }, { value: "none", label: "Unassigned" }, ...staffOpts]} />
            {(forms?.length ?? 0) > 1 && <ParamSelect name="form" label="Web form" allLabel="Any form" options={(forms ?? []).map((f) => ({ value: String(f.id), label: f.name }))} />}
            {!board && <ParamSelect name="sort" label="Sort" allLabel="Newest first" options={SORTS} />}
          </div>
          <SearchInput placeholder="Search name, company, e-mail or message…" />
        </div>
        {!board && (
          <div className="flex flex-wrap gap-1.5 border-b border-slate-100 px-4 py-3">
            <Link href={link({ status: undefined })} className={pill(!sp.status)}>Open <span className="opacity-60">{matched.filter((r) => isOpen(r.status)).length}</span></Link>
            {statuses.list.map((v) => (
              <Link key={v.key} href={link({ status: sp.status === v.key ? undefined : v.key })} className={pill(sp.status === v.key)}>
                {v.name} <span className="opacity-60">{count(v.key)}</span>
              </Link>
            ))}
            <Link href={link({ status: sp.status === "all" ? undefined : "all" })} className={pill(sp.status === "all")}>All <span className="opacity-60">{matched.length}</span></Link>
          </div>
        )}

        {board ? (
          <RequestBoard
            canEdit={canEdit}
            columns={statuses.list.map((s) => ({ key: s.key, name: s.name, color: s.color }))}
            cards={matched.map((r) => ({ id: r.id, name: r.name, company: r.company, budget: r.budget, status: r.status, created_at: r.created_at, assignee: r.assignee?.full_name ?? null }))}
          />
        ) : !rows.length ? (
          <EmptyState icon={Inbox} title={filtered || sp.status ? "No matching requests" : "Inbox zero"} description={filtered || sp.status ? "Nothing matches these filters." : "New requests from your website appear here."} />
        ) : (
          <>
            {canEdit && (
              <BulkBar
                id="request-bulk"
                action={bulkEstimateRequests}
                noun="request"
                ops={[
                  { value: "status", label: "Change status", target: { label: "Status", options: statuses.list.map((s) => ({ value: s.key, label: s.name })) } },
                  { value: "assign", label: "Assign to", target: { label: "Staff member", options: [{ value: "none", label: "— Unassigned —" }, ...staffOpts] } },
                  ...(can("sales", "full") ? [{ value: "delete", label: "Delete", danger: true }] : []),
                ]}
              />
            )}
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    {canEdit && <th className="w-8"><SelectAll form="request-bulk" label="Select all requests on this page" /></th>}
                    <th>Request</th>
                    <th className="hidden md:table-cell">Contact</th>
                    <th className="hidden lg:table-cell">Budget</th>
                    <th className="hidden sm:table-cell">Assigned to</th>
                    <th className="hidden md:table-cell">Received</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const st = statuses.of(r.status);
                    return (
                      <tr key={r.id}>
                        {canEdit && <td><input type="checkbox" name="ids" value={r.id} form="request-bulk" aria-label={`Select request from ${r.name}`} className="h-4 w-4 rounded border-slate-300 text-brand-600" /></td>}
                        <td className="max-w-md">
                          <Link href={`/estimate-requests/${r.id}`} className="font-semibold text-slate-900 hover:text-brand-700">{r.name}</Link>
                          {r.company && <span className="text-sm text-slate-500"> · {r.company}</span>}
                          {r.message && <p className="line-clamp-1 text-xs text-slate-500">{r.message}</p>}
                          <div className="text-[11px] text-slate-400">{r.form?.name ?? "Web form"}</div>
                        </td>
                        <td className="hidden text-xs text-slate-600 md:table-cell">
                          {r.email && <div className="truncate">{r.email}</div>}
                          {r.phone && <div>{r.phone}</div>}
                        </td>
                        <td className="hidden text-slate-600 lg:table-cell">{r.budget ?? "—"}</td>
                        <td className="hidden text-slate-600 sm:table-cell">{r.assignee?.full_name ?? <span className="text-slate-400">Unassigned</span>}</td>
                        <td className="hidden whitespace-nowrap text-slate-500 md:table-cell" suppressHydrationWarning>{timeAgo(r.created_at)}</td>
                        <td><ColorBadge color={st.color}>{st.name}</ColorBadge></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pageSize={PAGE_SIZE} total={sorted.length} basePath="/estimate-requests" params={{ status: sp.status, assigned: sp.assigned, form: sp.form, q: sp.q, sort: sp.sort }} />
          </>
        )}
      </Card>
    </>
  );
}
