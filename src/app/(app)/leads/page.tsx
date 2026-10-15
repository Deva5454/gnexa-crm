import type { Metadata } from "next";
import Link from "next/link";
import { Columns3, List, Magnet, Plus } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge, ColorBadge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SearchInput } from "@/components/ui/search-input";
import { requireStaff } from "@/lib/auth";
import { cn, formatDate, formatMoney, searchTerm } from "@/lib/utils";
import { LeadsKanban } from "./kanban";

export const metadata: Metadata = { title: "Leads" };

type SP = { view?: string; q?: string; mine?: string; source?: string; show?: string };

export default async function LeadsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const view = sp.view === "list" ? "list" : "board";
  const { supabase, profile } = await requireStaff();

  let query = supabase
    .from("leads")
    .select(
      "id, name, company, email, phone, value, status_id, position, created_at, last_contact_at, is_lost, is_junk, converted_customer_id, source:lead_sources(name), assignee:profiles!leads_assigned_to_fkey(full_name), status:lead_statuses(name, color)",
    )
    .order("position")
    .limit(500);
  const term = sp.q ? searchTerm(sp.q) : "";
  if (term) query = query.or(`name.ilike.%${term}%,company.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`);
  if (sp.mine) query = query.eq("assigned_to", profile.id);
  if (sp.source) query = query.eq("source_id", Number(sp.source));
  if (sp.show === "lost") query = query.eq("is_lost", true);
  else if (sp.show === "junk") query = query.eq("is_junk", true);
  else query = query.eq("is_lost", false).eq("is_junk", false);

  const [{ data: leads }, { data: statuses }, { data: sources }, { data: settings }] = await Promise.all([
    query,
    supabase.from("lead_statuses").select("id, name, color").order("sort_order"),
    supabase.from("lead_sources").select("id, name").order("name"),
    supabase.from("company_settings").select("currency").maybeSingle(),
  ]);
  const currency = settings?.currency ?? "INR";
  const rows = leads ?? [];

  const href = (patch: Partial<SP>) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...patch })) if (v) next.set(k, v);
    const qs = next.toString();
    return qs ? `/leads?${qs}` : "/leads";
  };
  const pill = (active: boolean) =>
    cn("rounded-full px-3 py-1 text-xs font-medium", active ? "bg-ink-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50");

  const pipelineValue = rows.reduce((s, l) => s + (l.value ?? 0), 0);

  return (
    <>
      <PageHeader
        title="Leads"
        description={`${rows.length} leads · ${formatMoney(pipelineValue, currency)} in pipeline`}
        actions={
          <>
            <div className="flex rounded-lg bg-white p-0.5 ring-1 ring-slate-200">
              <Link href={href({ view: undefined })} className={cn("flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium", view === "board" ? "bg-brand-600 text-white" : "text-slate-600")}>
                <Columns3 className="h-3.5 w-3.5" /> Board
              </Link>
              <Link href={href({ view: "list" })} className={cn("flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium", view === "list" ? "bg-brand-600 text-white" : "text-slate-600")}>
                <List className="h-3.5 w-3.5" /> List
              </Link>
            </div>
            <LinkButton href="/leads/new">
              <Plus className="h-4 w-4" /> New lead
            </LinkButton>
          </>
        }
      />

      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          <Link href={href({ mine: undefined, show: undefined, source: undefined })} className={pill(!sp.mine && !sp.show && !sp.source)}>All open</Link>
          <Link href={href({ mine: sp.mine ? undefined : "1" })} className={pill(!!sp.mine)}>Assigned to me</Link>
          <Link href={href({ show: sp.show === "lost" ? undefined : "lost" })} className={pill(sp.show === "lost")}>Lost</Link>
          <Link href={href({ show: sp.show === "junk" ? undefined : "junk" })} className={pill(sp.show === "junk")}>Junk</Link>
          <span className="mx-1 h-5 w-px bg-slate-200" />
          {sources?.map((s) => (
            <Link key={s.id} href={href({ source: sp.source === String(s.id) ? undefined : String(s.id) })} className={pill(sp.source === String(s.id))}>
              {s.name}
            </Link>
          ))}
        </div>
        <SearchInput placeholder="Search leads…" />
      </div>

      {view === "board" ? (
        <LeadsKanban
          currency={currency}
          statuses={statuses ?? []}
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
          }))}
        />
      ) : (
        <Card>
          {!rows.length ? (
            <EmptyState icon={Magnet} title="No leads here" description="Capture a new prospect to get your pipeline moving." action={<LinkButton href="/leads/new"><Plus className="h-4 w-4" /> New lead</LinkButton>} />
          ) : (
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Lead</th>
                    <th className="hidden md:table-cell">Contact</th>
                    <th>Status</th>
                    <th className="hidden lg:table-cell">Source</th>
                    <th className="text-right">Value</th>
                    <th className="hidden md:table-cell">Assigned</th>
                    <th className="hidden xl:table-cell">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((l) => (
                    <tr key={l.id}>
                      <td>
                        <Link href={`/leads/${l.id}`} className="font-semibold text-slate-900 hover:text-brand-700">{l.name}</Link>
                        {l.company && <div className="text-xs text-slate-500">{l.company}</div>}
                      </td>
                      <td className="hidden text-slate-600 md:table-cell">
                        <div>{l.email ?? "—"}</div>
                        {l.phone && <div className="text-xs text-slate-400">{l.phone}</div>}
                      </td>
                      <td>
                        {l.status ? <ColorBadge color={l.status.color}>{l.status.name}</ColorBadge> : "—"}
                        {l.converted_customer_id && <Badge className="ml-1 bg-emerald-50 text-emerald-700 ring-emerald-200">Converted</Badge>}
                      </td>
                      <td className="hidden text-slate-600 lg:table-cell">{l.source?.name ?? "—"}</td>
                      <td className="text-right font-medium">{formatMoney(l.value, currency)}</td>
                      <td className="hidden md:table-cell">
                        {l.assignee ? (
                          <span className="flex items-center gap-2"><Avatar name={l.assignee.full_name} className="h-6 w-6 text-[10px]" />{l.assignee.full_name}</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="hidden text-slate-500 xl:table-cell">{formatDate(l.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </>
  );
}
