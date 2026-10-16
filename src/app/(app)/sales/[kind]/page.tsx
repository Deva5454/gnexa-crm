import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowDown, ArrowUp, Download, FileStack, FileText, Plus, Repeat, Wallet } from "lucide-react";
import { BulkBar, SelectAll, type BulkOp } from "@/components/crm/bulk-bar";
import { ParamSelect } from "@/components/ui/param-select";
import { bulkDocs } from "../actions";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { requireStaff } from "@/lib/auth";
import { docHref, docNumber, docStatus, KINDS, kindFromSlug, STATUS_FILTERS, type DocKind } from "@/lib/sales";
import { balancesFor, baseCurrency, toBase } from "@/lib/sales-data";
import { cn, formatDate, formatMoney, PAGE_SIZE } from "@/lib/utils";
import { allRows } from "@/lib/fetch-all";
import { todayIST } from "@/lib/dates";

export async function generateMetadata({ params }: { params: Promise<{ kind: string }> }): Promise<Metadata> {
  const kind = kindFromSlug((await params).kind);
  return { title: kind ? KINDS[kind].plural : "Sales" };
}

type SP = { q?: string; status?: string; page?: string; year?: string; agent?: string; recurring?: string; sent?: string; project?: string; sort?: string; dir?: string };

const BULK_FORM = "bulk-docs";
type SortKey = "number" | "date" | "due" | "total" | "party";
const SORT_KEYS: SortKey[] = ["number", "date", "due", "total", "party"];

export default async function DocsPage({ params, searchParams }: { params: Promise<{ kind: string }>; searchParams: Promise<SP> }) {
  const kind = kindFromSlug((await params).kind);
  if (!kind) notFound();
  const sp = await searchParams;
  const k = KINDS[kind];
  const page = Math.max(1, Number(sp.page) || 1);
  const { supabase, can, profile } = await requireStaff();
  if (!can("sales", "view")) notFound();
  // Recurring and subscription invoices are raised by the scheduled job (see 0020_scheduling.sql)
  const { data: docs } = await allRows((from, to) =>
    supabase
      .from("sales_docs")
      .select(
        "id, kind, number, subject, date, due_date, status, total, tax_total, currency, exchange_rate, sent_at, recurring_every, recurring_from, subscription_id, project_id, sale_agent, customer:customers(company), lead:leads(name, company), project:projects(name), agent:profiles!sales_docs_sale_agent_fkey(full_name)",
      )
      .eq("kind", kind)
      .order("date", { ascending: false })
      .order("number", { ascending: false })
      .range(from, to),
  );
  const bals = await balancesFor(supabase, (docs ?? []).map((d) => d.id));
  const today = todayIST();

  const all = (docs ?? []).map((d) => {
    const bal = bals.get(d.id);
    return {
      ...d,
      total: Number(d.total),
      party: d.customer?.company ?? d.lead?.company ?? d.lead?.name ?? "—",
      bal,
      st: docStatus({ kind: d.kind as DocKind, status: d.status, due_date: d.due_date, total: Number(d.total) }, bal, today),
    };
  });

  // Summary tiles
  // Totals add documents in different currencies, so each amount is converted with its document's rate
  const base = await baseCurrency(supabase);
  const sum = (xs: typeof all, f: (x: (typeof all)[number]) => number) => xs.reduce((s, x) => s + toBase(f(x), x.exchange_rate), 0);
  const fm = (v: number) => formatMoney(v, base);
  const live = all.filter((d) => d.status !== "cancelled" && d.status !== "draft");
  const tiles =
    kind === "invoice"
      ? [
          { label: "Outstanding", value: fm(sum(live, (d) => Math.max(0, d.bal?.balance ?? d.total))), tone: "text-slate-900" },
          { label: "Overdue", value: fm(sum(all.filter((d) => d.st.key === "overdue"), (d) => d.bal?.balance ?? d.total)), tone: "text-rose-600" },
          { label: "Collected", value: fm(sum(all, (d) => (d.bal?.paid ?? 0))), tone: "text-emerald-600" },
          { label: "Drafts", value: String(all.filter((d) => d.status === "draft").length), tone: "text-slate-400" },
        ]
      : kind === "credit_note"
        ? [
            { label: "Credit issued", value: fm(sum(live, (d) => d.total)), tone: "text-slate-900" },
            { label: "Credit remaining", value: fm(sum(live, (d) => Math.max(0, d.bal?.balance ?? d.total))), tone: "text-violet-600" },
            { label: "Open notes", value: String(all.filter((d) => d.st.key === "open").length), tone: "text-slate-900" },
            { label: "Drafts", value: String(all.filter((d) => d.status === "draft").length), tone: "text-slate-400" },
          ]
        : [
            { label: "Sent & awaiting", value: fm(sum(all.filter((d) => d.st.key === "sent"), (d) => d.total)), tone: "text-sky-600" },
            { label: "Accepted", value: fm(sum(all.filter((d) => d.st.key === "accepted"), (d) => d.total)), tone: "text-emerald-600" },
            { label: "Declined / expired", value: String(all.filter((d) => d.st.key === "declined" || d.st.key === "expired").length), tone: "text-rose-600" },
            { label: "Drafts", value: String(all.filter((d) => d.status === "draft").length), tone: "text-slate-400" },
          ];

  // Perfex "Not sent": never e-mailed to the customer (the e-mail log knows)
  const emailed = new Set<number>();
  if (sp.sent) {
    const { data: logs } = await allRows((a, b) => supabase.from("email_log").select("rel_id").eq("rel_type", "sales_doc").not("rel_id", "is", null).order("id").range(a, b));
    for (const l of logs) emailed.add(l.rel_id!);
  }
  const q = (sp.q ?? "").trim().toLowerCase();
  const agent = sp.agent === "me" ? profile.id : sp.agent;
  // Everything but the status filter — the status chips count within these
  const scoped = all.filter(
    (d) =>
      (!q || docNumber(kind, d.number).toLowerCase().includes(q) || d.party.toLowerCase().includes(q) || (d.subject ?? "").toLowerCase().includes(q)) &&
      (!sp.year || d.date.startsWith(`${sp.year}-`)) &&
      (!agent || (agent === "none" ? !d.sale_agent : d.sale_agent === agent)) &&
      (!sp.recurring || !!(d.recurring_every || d.recurring_from || d.subscription_id)) &&
      (!sp.sent || !emailed.has(d.id)) &&
      (!sp.project || (sp.project === "any" ? !!d.project_id : d.project_id === Number(sp.project))),
  );
  const filtered = scoped.filter((d) => !sp.status || d.st.key === sp.status);
  const counts = new Map<string, number>();
  for (const d of scoped) counts.set(d.st.key, (counts.get(d.st.key) ?? 0) + 1);

  // Sorting (Perfex sorts every column); newest first by default
  const sortKey: SortKey = SORT_KEYS.includes(sp.sort as SortKey) ? (sp.sort as SortKey) : "date";
  const asc = sp.dir === "asc";
  const cmp: Record<SortKey, (a: (typeof all)[number], b: (typeof all)[number]) => number> = {
    number: (a, b) => a.number - b.number,
    date: (a, b) => a.date.localeCompare(b.date) || a.number - b.number,
    due: (a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"),
    total: (a, b) => toBase(a.total, a.exchange_rate) - toBase(b.total, b.exchange_rate),
    party: (a, b) => a.party.localeCompare(b.party),
  };
  filtered.sort((a, b) => (asc ? 1 : -1) * cmp[sortKey](a, b));
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const [{ data: staff }, { data: projects }] = await Promise.all([
    supabase.from("profiles").select("id, full_name").eq("is_active", true).order("full_name"),
    kind === "invoice" ? supabase.from("projects").select("id, name").order("name").limit(500) : Promise.resolve({ data: null }),
  ]);
  const years = [...new Set(all.map((d) => d.date.slice(0, 4)))].sort().reverse();

  const qp = { ...sp, page: undefined } as Record<string, string | undefined>;
  const link = (patch: Partial<SP>) => {
    const next = new URLSearchParams();
    for (const [key, v] of Object.entries({ ...qp, ...patch })) if (v) next.set(key, v);
    const qs = next.toString();
    return `/sales/${k.slug}${qs ? `?${qs}` : ""}`;
  };
  const href = (status?: string) => link({ status });
  const sortHead = (key: SortKey, label: string, className?: string) => {
    const on = sortKey === key;
    const Icon = on && asc ? ArrowUp : ArrowDown;
    return (
      <th className={className} aria-sort={on ? (asc ? "ascending" : "descending") : "none"}>
        <Link href={link({ sort: key === "date" ? undefined : key, dir: on && !asc ? "asc" : undefined })} className={cn("inline-flex items-center gap-1 hover:text-slate-900", on && "text-slate-900")}>
          {label}
          <Icon className={cn("h-3 w-3", on ? "opacity-100" : "opacity-0")} aria-hidden />
        </Link>
      </th>
    );
  };
  const staffOpts = (staff ?? []).map((p) => ({ value: p.id, label: p.full_name }));
  const bulkOps: BulkOp[] = [
    { value: "pdf", label: "Download / print PDFs" },
    { value: "sent", label: "Mark as sent (drafts)" },
    ...(kind === "proposal" || kind === "estimate"
      ? [{ value: "accepted", label: "Mark accepted" }, { value: "declined", label: "Mark declined" }]
      : [{ value: "cancelled", label: "Cancel" }]),
    { value: "agent", label: "Change sale agent", target: { label: "New sale agent", options: [{ value: "none", label: "— None —" }, ...staffOpts] } },
    ...(can("sales", "full") ? [{ value: "delete", label: "Delete", danger: true }] : []),
  ];
  const pill = (active: boolean) =>
    cn("rounded-full px-3 py-1 text-xs font-medium", active ? "bg-ink-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50");
  const canEdit = can("sales", "edit");

  return (
    <>
      <PageHeader
        title={k.plural}
        description={k.blurb}
        actions={
          <>
            {kind === "invoice" && canEdit && (
              <LinkButton href="/sales/payments/batch" variant="secondary">
                <Wallet className="h-4 w-4" /> Batch payments
              </LinkButton>
            )}
            <LinkButton href={`/bulk-pdf?kind=${kind}`} variant="secondary">
              <FileStack className="h-4 w-4" /> Bulk PDF
            </LinkButton>
            <LinkButton href={`/csv-export/${kind}s`} variant="secondary">
              <Download className="h-4 w-4" /> Export
            </LinkButton>
            {canEdit && (
              <LinkButton href={`/sales/${k.slug}/new`}>
                <Plus className="h-4 w-4" /> New {k.label.toLowerCase()}
              </LinkButton>
            )}
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <Card key={t.label} className="px-5 py-4">
            <div className="text-xs font-medium text-slate-500">{t.label}</div>
            <div className={cn("mt-1 text-xl font-bold", t.tone)}>{t.value}</div>
          </Card>
        ))}
      </div>

      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-1.5">
            <Link href={href()} className={pill(!sp.status)}>All <span className="opacity-60">{scoped.length}</span></Link>
            {STATUS_FILTERS[kind].map((f) => {
              const n = counts.get(f.key) ?? 0;
              return (
                <Link key={f.key} href={href(sp.status === f.key ? undefined : f.key)} className={pill(sp.status === f.key)}>
                  {f.label} <span className="opacity-60">{n}{scoped.length ? ` · ${Math.round((n / scoped.length) * 100)}%` : ""}</span>
                </Link>
              );
            })}
          </div>
          <SearchInput placeholder={`Search ${k.plural.toLowerCase()}…`} />
        </div>
        <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 px-4 py-3">
          {years.length > 1 && <ParamSelect name="year" label="Year" allLabel="All years" options={years.map((y) => ({ value: y, label: y }))} />}
          <ParamSelect name="agent" label="Sale agent" allLabel="Any sale agent" options={[{ value: "me", label: "My sales" }, { value: "none", label: "No sale agent" }, ...staffOpts]} />
          <ParamSelect name="sent" label="E-mailed" allLabel="E-mailed or not" options={[{ value: "not", label: "Not e-mailed yet" }]} />
          {kind === "invoice" && <ParamSelect name="recurring" label="Recurring" allLabel="Recurring or not" options={[{ value: "1", label: "Recurring only" }]} />}
          {kind === "invoice" && (projects?.length ?? 0) > 0 && (
            <ParamSelect name="project" label="Project" allLabel="Any project" options={[{ value: "any", label: "Project invoices" }, ...(projects ?? []).map((p) => ({ value: String(p.id), label: p.name }))]} />
          )}
        </div>
        {canEdit && (
          <>
            <BulkBar id={BULK_FORM} action={bulkDocs} noun={k.label.toLowerCase()} ops={bulkOps} />
            <input type="hidden" name="kind" value={kind} form={BULK_FORM} />
          </>
        )}

        {!rows.length ? (
          <EmptyState
            icon={FileText}
            title={all.length ? "Nothing matches" : `No ${k.plural.toLowerCase()} yet`}
            description={all.length ? "Try another filter or search." : k.blurb}
            action={!all.length && canEdit && <LinkButton href={`/sales/${k.slug}/new`}><Plus className="h-4 w-4" /> New {k.label.toLowerCase()}</LinkButton>}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    {canEdit && <th className="w-8"><SelectAll form={BULK_FORM} label={`Select all ${k.plural.toLowerCase()} on this page`} /></th>}
                    {sortHead("number", "Number")}
                    {sortHead("party", kind === "proposal" ? "To" : "Customer")}
                    <th className="hidden lg:table-cell">{kind === "invoice" ? "Subject / project" : "Subject"}</th>
                    {sortHead("date", "Date", "hidden md:table-cell")}
                    {k.dueLabel && sortHead("due", k.dueLabel, "hidden md:table-cell")}
                    <th className="hidden text-right xl:table-cell">Tax</th>
                    {sortHead("total", "Total", "text-right")}
                    {(kind === "invoice" || kind === "credit_note") && <th className="hidden text-right sm:table-cell">{kind === "invoice" ? "Balance" : "Remaining"}</th>}
                    <th className="hidden xl:table-cell">Sale agent</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((d) => (
                    <tr key={d.id}>
                      {canEdit && (
                        <td>
                          <input type="checkbox" name="ids" value={d.id} form={BULK_FORM} aria-label={`Select ${docNumber(kind, d.number)}`} className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
                        </td>
                      )}
                      <td>
                        <Link href={docHref(kind, d.id)} className="font-mono text-sm font-semibold text-brand-700 hover:underline">
                          {docNumber(kind, d.number)}
                        </Link>
                        {(d.recurring_every || d.recurring_from || d.subscription_id) && (
                          <Repeat
                            className={cn("ml-1.5 inline h-3.5 w-3.5", d.recurring_every ? "text-violet-600" : "text-slate-400")}
                            aria-label={d.recurring_every ? "Recurring template" : d.subscription_id ? "From a subscription" : "Recurring copy"}
                          />
                        )}
                      </td>
                      <td className="font-medium text-slate-800">
                        {d.party}
                        {!d.customer && d.lead && <Badge className="ml-2 bg-amber-50 text-amber-700 ring-amber-200">Lead</Badge>}
                      </td>
                      <td className="hidden max-w-[240px] text-slate-500 lg:table-cell">
                        <div className="truncate">{d.subject ?? "—"}</div>
                        {d.project && <Link href={`/projects/${d.project_id}`} className="block truncate text-xs text-brand-600 hover:underline">{d.project.name}</Link>}
                      </td>
                      <td className="hidden whitespace-nowrap text-slate-600 md:table-cell">{formatDate(d.date)}</td>
                      {k.dueLabel && (
                        <td className={cn("hidden whitespace-nowrap md:table-cell", d.st.key === "overdue" || d.st.key === "expired" ? "font-semibold text-rose-600" : "text-slate-600")}>
                          {formatDate(d.due_date)}
                        </td>
                      )}
                      <td className="hidden whitespace-nowrap text-right text-slate-500 xl:table-cell">{formatMoney(Number(d.tax_total), d.currency)}</td>
                      <td className="whitespace-nowrap text-right font-semibold">{formatMoney(d.total, d.currency)}</td>
                      {(kind === "invoice" || kind === "credit_note") && (
                        <td className="hidden whitespace-nowrap text-right text-slate-600 sm:table-cell">
                          {d.status === "cancelled" || d.status === "draft" ? "—" : formatMoney(Math.max(0, d.bal?.balance ?? d.total), d.currency)}
                        </td>
                      )}
                      <td className="hidden text-slate-600 xl:table-cell">{d.agent?.full_name ?? "—"}</td>
                      <td>
                        <Badge className={d.st.color}>{d.st.label}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} basePath={`/sales/${k.slug}`} params={qp} />
          </>
        )}
      </Card>
    </>
  );
}
