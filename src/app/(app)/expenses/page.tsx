import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowDown, ArrowUp, Download, Paperclip, Plus, Receipt, Repeat } from "lucide-react";
import { BulkBar, SelectAll } from "@/components/crm/bulk-bar";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { ParamSelect } from "@/components/ui/param-select";
import { SearchInput } from "@/components/ui/search-input";
import { requireStaff } from "@/lib/auth";
import { docHref, docNumber } from "@/lib/sales";
import { cn, formatDate, formatMoney, PAGE_SIZE, searchTerm } from "@/lib/utils";
import { allRows } from "@/lib/fetch-all";
import { PERIODS, periodRange } from "@/lib/dates";
import { baseCurrency } from "@/lib/sales-data";
import { bulkExpenses } from "./actions";

export const metadata: Metadata = { title: "Expenses" };

type SP = { q?: string; category?: string; billable?: string; page?: string; period?: string; mode?: string; customer?: string; project?: string; recurring?: string; sort?: string; dir?: string };

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const { supabase, can } = await requireStaff();
  if (!can("expenses", "view")) notFound();
  const canEdit = can("expenses", "edit");
  // Recurring expenses are added by the scheduled job (see 0020_scheduling.sql)

  // Everything matching the filters (light columns): drives the totals, sorting and paging
  const range = periodRange(sp.period);
  const term = sp.q ? searchTerm(sp.q) : "";
  const { data: matched } = await allRows((a, b) => {
    let q = supabase.from("expenses").select("id, amount, tax_rate, date, is_billable, invoice_id, customer_id, category_id").order("id").range(a, b);
    if (term) q = q.or(`name.ilike.%${term}%,reference.ilike.%${term}%`);
    if (range) q = q.gte("date", range[0]).lte("date", range[1]);
    if (Number(sp.category)) q = q.eq("category_id", Number(sp.category));
    if (Number(sp.mode)) q = q.eq("payment_mode_id", Number(sp.mode));
    if (Number(sp.customer)) q = q.eq("customer_id", Number(sp.customer));
    if (Number(sp.project)) q = q.eq("project_id", Number(sp.project));
    if (sp.billable === "1" || sp.billable === "pending") q = q.eq("is_billable", true).is("invoice_id", null).not("customer_id", "is", null);
    if (sp.billable === "billed") q = q.not("invoice_id", "is", null);
    if (sp.billable === "no") q = q.eq("is_billable", false);
    if (sp.recurring === "1") q = q.or("recurring_every.not.is.null,recurring_from.not.is.null");
    return q;
  });

  const gross = (e: { amount: number; tax_rate: number }) => Number(e.amount) * (1 + Number(e.tax_rate) / 100);
  const all = matched ?? [];
  const byAmount = sp.sort === "amount";
  const asc = sp.dir === "asc";
  const sorted = [...all].sort((x, y) => {
    const d = byAmount ? gross(x) - gross(y) : x.date.localeCompare(y.date) || x.id - y.id;
    return asc ? d : -d;
  });
  const pageIds = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((e) => e.id);

  const [{ data: details }, { data: cats }, { data: modes }, { data: customers }, { data: projects }] = await Promise.all([
    pageIds.length
      ? supabase
          .from("expenses")
          .select("id, name, amount, tax_rate, date, is_billable, reference, recurring_every, recurring_from, receipt_path, category:expense_categories(name), customer:customers(id, company), project:projects(id, name), mode:payment_modes(name), invoice:sales_docs(id, number)")
          .in("id", pageIds)
      : Promise.resolve({ data: [] }),
    supabase.from("expense_categories").select("id, name").order("name"),
    supabase.from("payment_modes").select("id, name").order("name"),
    supabase.from("customers").select("id, company").order("company").limit(1000),
    supabase.from("projects").select("id, name").order("name").limit(1000),
  ]);
  const rows = pageIds.map((id) => details?.find((d) => d.id === id)).filter((r): r is NonNullable<typeof r> => !!r);

  const base = await baseCurrency(supabase); // expenses are recorded in the base currency
  const sum = (list: typeof all) => list.reduce((s, e) => s + gross(e), 0);
  const tiles = [
    { label: "Total", value: sum(all), tone: "text-slate-900", n: all.length },
    { label: "Billable", value: sum(all.filter((e) => e.is_billable)), tone: "text-slate-900", n: all.filter((e) => e.is_billable).length },
    { label: "Not billable", value: sum(all.filter((e) => !e.is_billable)), tone: "text-slate-500", n: all.filter((e) => !e.is_billable).length },
    { label: "Pending billing", value: sum(all.filter((e) => e.is_billable && !e.invoice_id && e.customer_id)), tone: "text-amber-600", n: all.filter((e) => e.is_billable && !e.invoice_id && e.customer_id).length },
    { label: "Billed", value: sum(all.filter((e) => e.invoice_id)), tone: "text-emerald-600", n: all.filter((e) => e.invoice_id).length },
  ];

  const catTotals = new Map<number | null, number>();
  for (const e of all) catTotals.set(e.category_id, (catTotals.get(e.category_id) ?? 0) + gross(e));
  const byCat = [...catTotals.entries()]
    .map(([id, total]) => ({ id, name: (cats ?? []).find((c) => c.id === id)?.name ?? "Uncategorised", total }))
    .sort((a, b) => b.total - a.total);
  const maxCat = Math.max(1, ...byCat.map((c) => c.total));

  const href = (patch: Partial<SP>) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...patch, page: undefined })) if (v) next.set(k, v);
    const qs = next.toString();
    return qs ? `/expenses?${qs}` : "/expenses";
  };
  const sortLink = (key: "date" | "amount", label: string, className?: string) => {
    const active = (sp.sort ?? "date") === key;
    const Icon = active && asc ? ArrowUp : ArrowDown;
    return (
      <Link href={href({ sort: key === "date" ? undefined : key, dir: active && !asc ? "asc" : undefined })} className={cn("inline-flex items-center gap-1 hover:text-slate-900", className)}>
        {label} {active && <Icon className="h-3 w-3" />}
      </Link>
    );
  };
  const pill = (active: boolean) =>
    cn("rounded-full px-3 py-1 text-xs font-medium", active ? "bg-ink-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50");
  const opt = (list: { id: number; name: string }[] | null) => (list ?? []).map((x) => ({ value: String(x.id), label: x.name }));
  const periodLabel = PERIODS.find((p) => p.value === sp.period)?.label ?? "All time";

  return (
    <>
      <PageHeader
        title="Expenses"
        description="What the business spends, by category — and what can be re-billed."
        actions={
          <>
            <LinkButton href="/csv-export/expenses" variant="secondary"><Download className="h-4 w-4" /> Export</LinkButton>
            {canEdit && <LinkButton href="/expenses/new"><Plus className="h-4 w-4" /> New expense</LinkButton>}
          </>
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map((t) => (
          <Card key={t.label} className="px-4 py-3">
            <div className="text-xs font-medium text-slate-500">{t.label}</div>
            <div className={cn("mt-1 text-lg font-bold", t.tone)}>{formatMoney(t.value, base)}</div>
            <div className="text-[11px] text-slate-400">{t.n} · {periodLabel.toLowerCase()}</div>
          </Card>
        ))}
      </div>

      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex flex-wrap items-center gap-1.5">
            <Link href={href({ billable: undefined })} className={pill(!sp.billable)}>All</Link>
            <Link href={href({ billable: sp.billable === "pending" || sp.billable === "1" ? undefined : "pending" })} className={pill(sp.billable === "pending" || sp.billable === "1")}>Pending billing</Link>
            <Link href={href({ billable: sp.billable === "billed" ? undefined : "billed" })} className={pill(sp.billable === "billed")}>Billed</Link>
            <Link href={href({ billable: sp.billable === "no" ? undefined : "no" })} className={pill(sp.billable === "no")}>Not billable</Link>
            <Link href={href({ recurring: sp.recurring ? undefined : "1" })} className={pill(sp.recurring === "1")}>Recurring</Link>
            <span className="mx-1 h-5 w-px bg-slate-200" />
            <ParamSelect name="period" label="Period" allLabel="All time" options={PERIODS} />
            <ParamSelect name="category" label="Category" allLabel="Any category" options={opt(cats)} />
            <ParamSelect name="mode" label="Payment mode" allLabel="Any payment mode" options={opt(modes)} />
            <ParamSelect name="customer" label="Customer" allLabel="Any customer" options={(customers ?? []).map((c) => ({ value: String(c.id), label: c.company }))} />
            <ParamSelect name="project" label="Project" allLabel="Any project" options={opt(projects)} />
          </div>
          <SearchInput placeholder="Search name or reference…" />
        </div>
        {!rows.length ? (
          <EmptyState icon={Receipt} title="No expenses" description={Object.values({ ...sp, page: undefined, sort: undefined, dir: undefined }).some(Boolean) ? "Nothing matches these filters." : "Log travel, software, supplies and more."} />
        ) : (
          <>
            {canEdit && (
              <BulkBar
                id="expense-bulk"
                action={bulkExpenses}
                noun="expense"
                ops={[
                  { value: "category", label: "Change category", target: { label: "Category", options: opt(cats) } },
                  { value: "mode", label: "Change payment mode", target: { label: "Payment mode", options: opt(modes) } },
                  { value: "billable", label: "Mark billable (if linked to a customer)" },
                  { value: "not_billable", label: "Mark not billable (if not yet billed)" },
                  ...(can("expenses", "full") ? [{ value: "delete", label: "Delete", danger: true }] : []),
                ]}
              />
            )}
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    {canEdit && <th className="w-8"><SelectAll form="expense-bulk" label="Select all expenses on this page" /></th>}
                    <th>Expense</th>
                    <th className="hidden md:table-cell">Category</th>
                    <th className="hidden md:table-cell">{sortLink("date", "Date")}</th>
                    <th className="hidden lg:table-cell">Customer / project</th>
                    <th className="hidden xl:table-cell">Paid via</th>
                    <th className="text-right">{sortLink("amount", "Amount", "justify-end")}</th>
                    <th>Billing</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((e) => (
                    <tr key={e.id}>
                      {canEdit && <td><input type="checkbox" name="ids" value={e.id} form="expense-bulk" aria-label={`Select ${e.name}`} className="h-4 w-4 rounded border-slate-300 text-brand-600" /></td>}
                      <td>
                        <Link href={`/expenses/${e.id}`} className="font-medium text-slate-900 hover:text-brand-700">{e.name}</Link>
                        {(e.recurring_every || e.recurring_from) && <Repeat className={`ml-1.5 inline h-3.5 w-3.5 ${e.recurring_every ? "text-violet-600" : "text-slate-400"}`} aria-label={e.recurring_every ? "Repeats" : "Recurring copy"} />}
                        {e.receipt_path && <Paperclip className="ml-1 inline h-3.5 w-3.5 text-slate-400" aria-label="Receipt attached" />}
                        {e.reference && <div className="text-xs text-slate-400">{e.reference}</div>}
                      </td>
                      <td className="hidden text-slate-600 md:table-cell">{e.category?.name ?? "—"}</td>
                      <td className="hidden whitespace-nowrap text-slate-600 md:table-cell">{formatDate(e.date)}</td>
                      <td className="hidden lg:table-cell">
                        {e.customer ? <Link href={`/customers/${e.customer.id}`} className="text-slate-700 hover:text-brand-700">{e.customer.company}</Link> : <span className="text-slate-400">Internal</span>}
                        {e.project && <div className="text-xs"><Link href={`/projects/${e.project.id}?tab=expenses`} className="text-slate-500 hover:text-brand-700">{e.project.name}</Link></div>}
                      </td>
                      <td className="hidden text-slate-600 xl:table-cell">{e.mode?.name ?? "—"}</td>
                      <td className="whitespace-nowrap text-right">
                        <div className="font-semibold">{formatMoney(gross(e), base)}</div>
                        {Number(e.tax_rate) > 0 && <div className="text-[11px] text-slate-400">incl. GST {Number(e.tax_rate)}%</div>}
                      </td>
                      <td>
                        {e.invoice ? (
                          <Link href={docHref("invoice", e.invoice.id)} title="Billed — open the invoice">
                            <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-200">Billed · {docNumber("invoice", e.invoice.number)}</Badge>
                          </Link>
                        ) : e.is_billable && e.customer ? (
                          <Link href={`/sales/invoices/new?customer=${e.customer.id}&expense=${e.id}`} title="Add to a new invoice for this customer">
                            <Badge className="bg-amber-50 text-amber-700 ring-amber-200">Pending billing</Badge>
                          </Link>
                        ) : (
                          <span className="text-xs text-slate-400">Not billable</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pageSize={PAGE_SIZE} total={all.length} basePath="/expenses" params={{ q: sp.q, category: sp.category, billable: sp.billable, period: sp.period, mode: sp.mode, customer: sp.customer, project: sp.project, recurring: sp.recurring, sort: sp.sort, dir: sp.dir }} />
          </>
        )}
      </Card>
      {byCat.length > 1 && (
        <Card className="mt-6">
          <CardHeader title="By category" description={`${periodLabel}, incl. tax — follows the filters above`} />
          <CardBody className="space-y-2.5">
            {byCat.map((c) => (
              <div key={c.name} className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3 text-sm">
                <Link href={c.id ? href({ category: String(c.id) }) : href({})} className="truncate text-slate-700 hover:text-brand-700">{c.name}</Link>
                <span className="h-2 rounded-full bg-slate-100"><span className="block h-2 rounded-full bg-brand-500" style={{ width: `${Math.max(2, (c.total / maxCat) * 100)}%` }} /></span>
                <span className="whitespace-nowrap text-right text-xs font-medium text-slate-700">{formatMoney(c.total, base)}</span>
              </div>
            ))}
          </CardBody>
        </Card>
      )}
    </>
  );
}

