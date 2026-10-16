import type { Metadata } from "next";
import { allTags, idsWithTag, tagsFor } from "@/components/crm/tags";
import { TagChip } from "@/components/crm/tag-editor";
import { TagFilter } from "@/components/crm/tag-filter";
import Link from "next/link";
import { ArrowDown, ArrowUp, Columns3, Download, List, Magnet, Plus, Upload } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge, ColorBadge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { ParamSelect } from "@/components/ui/param-select";
import { SearchInput } from "@/components/ui/search-input";
import { requireStaff } from "@/lib/auth";
import { todayIST } from "@/lib/dates";
import { cn, formatDate, formatMoney, searchTerm, timeAgo } from "@/lib/utils";
import { BULK_FORM, BulkBar, SelectAll } from "./bulk-bar";
import { LeadsKanban, type KanbanSort } from "./kanban";
import { allRows } from "@/lib/fetch-all";

export const metadata: Metadata = { title: "Leads" };

type SP = {
  view?: string; q?: string; mine?: string; assigned?: string; status?: string; source?: string; show?: string;
  when?: string; tag?: string; sort?: string; dir?: string; page?: string; ksort?: string;
};

const PAGE_SIZE = 50;
// List columns that can be sorted, and the database column behind each
const SORTS: Record<string, string> = { id: "id", name: "name", company: "company", value: "value", last_contact: "last_contact_at", created: "created_at" };
const KSORTS: KanbanSort[] = ["position", "created", "last_contact", "value"];

export default async function LeadsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const view = sp.view === "list" ? "list" : "board";
  const { supabase, profile, can } = await requireStaff();
  const canEdit = can("leads", "edit");
  const assigned = sp.assigned ?? (sp.mine ? "me" : "");
  const dayStart = `${todayIST()}T00:00:00+05:30`;
  const tagIds = Number(sp.tag) ? await idsWithTag(supabase, "lead", Number(sp.tag)) : null;

  const base = (count: boolean) => {
    let q = supabase
      .from("leads")
      .select(
        "id, name, company, email, phone, value, status_id, position, created_at, last_contact_at, is_lost, is_junk, converted_customer_id, source:lead_sources(name), assignee:profiles!leads_assigned_to_fkey(full_name), status:lead_statuses(name, color)",
        count ? { count: "exact" } : undefined,
      );
    const term = sp.q ? searchTerm(sp.q) : "";
    if (term) q = q.or(`name.ilike.%${term}%,company.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`);
    if (assigned === "me") q = q.eq("assigned_to", profile.id);
    else if (assigned === "none") q = q.is("assigned_to", null);
    else if (/^[0-9a-f-]{36}$/i.test(assigned)) q = q.eq("assigned_to", assigned);
    if (Number(sp.status)) q = q.eq("status_id", Number(sp.status));
    if (Number(sp.source)) q = q.eq("source_id", Number(sp.source));
    if (sp.show === "lost") q = q.eq("is_lost", true);
    else if (sp.show === "junk") q = q.eq("is_junk", true);
    else if (sp.show !== "all") q = q.eq("is_lost", false).eq("is_junk", false);
    if (sp.when === "contacted_today") q = q.gte("last_contact_at", dayStart);
    if (sp.when === "created_today") q = q.gte("created_at", dayStart);
    if (tagIds) q = q.in("id", tagIds.length ? tagIds : [0]);
    return q;
  };

  const sortKey = sp.sort && SORTS[sp.sort] ? sp.sort : "created";
  const asc = sp.dir === "asc";
  const page = Math.max(1, Number(sp.page) || 1);
  const ksort: KanbanSort = KSORTS.includes(sp.ksort as KanbanSort) ? (sp.ksort as KanbanSort) : "position";

  const [board, list, { data: summary }, { data: statuses }, { data: sources }, { data: staff }, { data: settings }, tagList] = await Promise.all([
    view === "board" ? allRows((a, b) => base(false).order("position").order("id").range(a, b), 10_000) : Promise.resolve(null),
    view === "list"
      ? base(true)
          .order(SORTS[sortKey]!, { ascending: asc, nullsFirst: false })
          .order("id", { ascending: asc })
          .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
      : Promise.resolve(null),
    allRows((a, b) => supabase.from("leads").select("status_id, is_lost, is_junk").order("id").range(a, b)),
    supabase.from("lead_statuses").select("id, name, color").order("sort_order"),
    supabase.from("lead_sources").select("id, name").order("name"),
    supabase.from("profiles").select("id, full_name").eq("is_active", true).order("full_name"),
    supabase.from("company_settings").select("currency").maybeSingle(),
    allTags(supabase),
  ]);
  const rows = board?.data ?? list?.data ?? [];
  const total = list?.count ?? rows.length;
  const tagMap = await tagsFor(supabase, "lead", rows.map((l) => l.id));
  const currency = settings?.currency ?? "INR";

  // Perfex "Leads summary": every lead, whatever the filters
  const all = summary ?? [];
  const live = all.filter((l) => !l.is_lost && !l.is_junk);
  const lost = all.filter((l) => l.is_lost).length;
  const junk = all.filter((l) => l.is_junk).length;
  const pct = (n: number) => (all.length ? Math.round((n / all.length) * 100) : 0);

  const href = (patch: Partial<SP>) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, mine: undefined, assigned: assigned || undefined, page: undefined, ...patch })) if (v) next.set(k, v);
    const qs = next.toString();
    return qs ? `/leads?${qs}` : "/leads";
  };
  const sortHead = (key: string, label: string, className?: string) => {
    const on = sortKey === key;
    const Icon = on && asc ? ArrowUp : ArrowDown;
    return (
      <th className={className} aria-sort={on ? (asc ? "ascending" : "descending") : "none"}>
        <Link href={href({ sort: key, dir: on && !asc ? "asc" : undefined })} className={cn("inline-flex items-center gap-1 hover:text-slate-900", on && "text-slate-900")}>
          {label}
          <Icon className={cn("h-3 w-3", on ? "opacity-100" : "opacity-0")} aria-hidden />
        </Link>
      </th>
    );
  };
  const opts = (xs: { id: number | string; name?: string; full_name?: string }[] | null) => (xs ?? []).map((x) => ({ value: String(x.id), label: x.name ?? x.full_name ?? "" }));
  const pipelineValue = rows.reduce((s, l) => s + (l.value ?? 0), 0);

  return (
    <>
      <PageHeader
        title="Leads"
        description={view === "board" ? `${rows.length} leads · ${formatMoney(pipelineValue, currency)} in pipeline` : `${total} leads`}
        actions={
          <>
            <div className="flex rounded-lg bg-white p-0.5 ring-1 ring-slate-200">
              <Link href={href({ view: undefined, sort: undefined, dir: undefined })} className={cn("flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium", view === "board" ? "bg-brand-600 text-white" : "text-slate-600")}>
                <Columns3 className="h-3.5 w-3.5" /> Board
              </Link>
              <Link href={href({ view: "list", ksort: undefined })} className={cn("flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium", view === "list" ? "bg-brand-600 text-white" : "text-slate-600")}>
                <List className="h-3.5 w-3.5" /> List
              </Link>
            </div>
            <LinkButton href="/csv-export/leads" variant="secondary">
              <Download className="h-4 w-4" /> Export
            </LinkButton>
            {canEdit && (
              <LinkButton href="/leads/import" variant="secondary">
                <Upload className="h-4 w-4" /> Import
              </LinkButton>
            )}
            {canEdit && (
              <LinkButton href="/leads/new">
                <Plus className="h-4 w-4" /> New lead
              </LinkButton>
            )}
          </>
        }
      />

      <section aria-label="Leads summary" className="mb-5 flex gap-2 overflow-x-auto pb-1">
        {(statuses ?? []).map((s) => {
          const n = live.filter((l) => l.status_id === s.id).length;
          const on = sp.status === String(s.id);
          return (
            <Link key={s.id} href={href({ status: on ? undefined : String(s.id), show: undefined })} className={cn("min-w-[7.5rem] shrink-0 rounded-xl border bg-white px-3 py-2 transition hover:border-brand-200", on ? "border-brand-400 ring-2 ring-brand-100" : "border-slate-200")}>
              <div className="text-lg font-bold text-slate-900">{n}</div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500"><span className="h-2 w-2 rounded-full" style={{ background: s.color }} />{s.name}</div>
            </Link>
          );
        })}
        {[
          { key: "lost", label: "Lost leads", n: lost, tone: "text-rose-600" },
          { key: "junk", label: "Junk leads", n: junk, tone: "text-slate-700" },
        ].map((x) => (
          <Link key={x.key} href={href({ show: sp.show === x.key ? undefined : x.key, status: undefined })} className={cn("min-w-[7.5rem] shrink-0 rounded-xl border bg-white px-3 py-2 transition hover:border-brand-200", sp.show === x.key ? "border-brand-400 ring-2 ring-brand-100" : "border-slate-200")}>
            <div className={cn("text-lg font-bold", x.tone)}>{x.n} <span className="text-xs font-medium text-slate-400">· {pct(x.n)}%</span></div>
            <div className="text-xs text-slate-500">{x.label}</div>
          </Link>
        ))}
      </section>

      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          <ParamSelect name="assigned" label="Assigned to" allLabel="Anyone" options={[{ value: "me", label: "Assigned to me" }, { value: "none", label: "Not assigned" }, ...opts(staff)]} />
          <ParamSelect name="status" label="Status" allLabel="All statuses" options={opts(statuses)} />
          <ParamSelect name="source" label="Source" allLabel="All sources" options={opts(sources)} />
          <ParamSelect name="show" label="Lost and junk" allLabel="Open leads" options={[{ value: "lost", label: "Lost" }, { value: "junk", label: "Junk" }, { value: "all", label: "All, incl. lost & junk" }]} />
          <ParamSelect name="when" label="Date" allLabel="Any date" options={[{ value: "contacted_today", label: "Contacted today" }, { value: "created_today", label: "Created today" }]} />
          {view === "board" && <ParamSelect name="ksort" label="Sort cards by" allLabel="Sort: board order" options={[{ value: "created", label: "Sort: newest first" }, { value: "last_contact", label: "Sort: last contact" }, { value: "value", label: "Sort: highest value" }]} />}
          {tagList.length > 0 && <TagFilter tags={tagList} />}
        </div>
        <SearchInput placeholder="Search leads…" />
      </div>

      {view === "board" ? (
        <LeadsKanban
          canEdit={canEdit}
          currency={currency}
          statuses={statuses ?? []}
          sortBy={ksort}
          leads={rows.map((l) => ({
            id: l.id,
            name: l.name,
            company: l.company,
            value: l.value,
            status_id: l.status_id,
            position: l.position,
            created_at: l.created_at,
            last_contact_at: l.last_contact_at,
            source: l.source?.name ?? null,
            assignee: l.assignee?.full_name ?? null,
            tags: tagMap.get(l.id) ?? [],
          }))}
        />
      ) : (
        <Card>
          {canEdit && (
            <BulkBar
              statuses={opts(statuses)}
              sources={opts(sources)}
              staff={opts(staff)}
              tags={tagList.map((t) => ({ value: String(t.id), label: t.name }))}
              canDelete={can("leads", "full")}
            />
          )}
          {!rows.length ? (
            <EmptyState icon={Magnet} title="No leads here" description="Try other filters, or capture a new prospect." action={canEdit && <LinkButton href="/leads/new"><Plus className="h-4 w-4" /> New lead</LinkButton>} />
          ) : (
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    {canEdit && <th className="w-8"><SelectAll /></th>}
                    {sortHead("id", "#", "w-12")}
                    {sortHead("name", "Name")}
                    {sortHead("company", "Company", "hidden lg:table-cell")}
                    <th className="hidden md:table-cell">Contact</th>
                    {sortHead("value", "Value", "text-right")}
                    <th>Status</th>
                    <th className="hidden lg:table-cell">Source</th>
                    <th className="hidden md:table-cell">Assigned</th>
                    {sortHead("last_contact", "Last contact", "hidden xl:table-cell")}
                    {sortHead("created", "Created", "hidden xl:table-cell")}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((l) => (
                    <tr key={l.id}>
                      {canEdit && (
                        <td>
                          <input type="checkbox" name="ids" value={l.id} form={BULK_FORM} aria-label={`Select ${l.name}`} className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
                        </td>
                      )}
                      <td className="text-xs text-slate-400">{l.id}</td>
                      <td>
                        <Link href={`/leads/${l.id}`} className="font-semibold text-slate-900 hover:text-brand-700">{l.name}</Link>
                        {(tagMap.get(l.id) ?? []).map((g) => <TagChip key={g.id} tag={g} className="ml-1.5 px-1.5 text-[10px]" />)}
                        {l.company && <div className="text-xs text-slate-500 lg:hidden">{l.company}</div>}
                      </td>
                      <td className="hidden text-slate-600 lg:table-cell">{l.company ?? "—"}</td>
                      <td className="hidden text-slate-600 md:table-cell">
                        <div>{l.email ?? "—"}</div>
                        {l.phone && <div className="text-xs text-slate-400">{l.phone}</div>}
                      </td>
                      <td className="text-right font-medium">{formatMoney(l.value, currency)}</td>
                      <td>
                        {l.status ? <ColorBadge color={l.status.color}>{l.status.name}</ColorBadge> : "—"}
                        {l.converted_customer_id && <Badge className="ml-1 bg-emerald-50 text-emerald-700 ring-emerald-200">Converted</Badge>}
                        {l.is_lost && <Badge className="ml-1 bg-rose-50 text-rose-700 ring-rose-200">Lost</Badge>}
                        {l.is_junk && <Badge className="ml-1 bg-slate-800 text-white ring-slate-800">Junk</Badge>}
                      </td>
                      <td className="hidden text-slate-600 lg:table-cell">{l.source?.name ?? "—"}</td>
                      <td className="hidden md:table-cell">
                        {l.assignee ? (
                          <span className="flex items-center gap-2"><Avatar name={l.assignee.full_name} className="h-6 w-6 text-[10px]" />{l.assignee.full_name}</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="hidden text-slate-500 xl:table-cell" suppressHydrationWarning>{l.last_contact_at ? timeAgo(l.last_contact_at) : "—"}</td>
                      <td className="hidden text-slate-500 xl:table-cell">{formatDate(l.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {total > PAGE_SIZE && (
            <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath="/leads" params={{ ...sp, mine: undefined, assigned: assigned || undefined, page: undefined }} />
          )}
        </Card>
      )}
    </>
  );
}
