import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Paperclip, Plus, Receipt, Repeat } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { requireStaff } from "@/lib/auth";
import { docHref, docNumber } from "@/lib/sales";
import { cn, formatDate, formatMoney, PAGE_SIZE, searchTerm } from "@/lib/utils";
import { allRows } from "@/lib/fetch-all";

export const metadata: Metadata = { title: "Expenses" };

type SP = { q?: string; category?: string; billable?: string; page?: string };

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const { supabase, can } = await requireStaff();
  if (!can("expenses", "view")) notFound();
  // Recurring expenses are added by the scheduled job (see 0020_scheduling.sql)

  let q = supabase
    .from("expenses")
    .select("id, name, amount, tax_rate, date, is_billable, reference, recurring_every, recurring_from, receipt_path, category:expense_categories(name), customer:customers(id, company), invoice:sales_docs(id, number)", { count: "exact" })
    .order("date", { ascending: false })
    .order("id", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  const term = sp.q ? searchTerm(sp.q) : "";
  if (term) q = q.or(`name.ilike.%${term}%,reference.ilike.%${term}%`);
  if (sp.category) q = q.eq("category_id", Number(sp.category));
  if (sp.billable === "1" || sp.billable === "pending") q = q.eq("is_billable", true).is("invoice_id", null).not("customer_id", "is", null);
  if (sp.billable === "billed") q = q.not("invoice_id", "is", null);

  const yearAgo = new Date(Date.now() - 365 * 86400_000).toISOString().slice(0, 10);
  const [{ data: rows, count }, { data: cats }, { data: recent }] = await Promise.all([
    q,
    supabase.from("expense_categories").select("id, name").order("name"),
    allRows((a, b) => supabase.from("expenses").select("amount, tax_rate, date, is_billable, invoice_id, category_id, customer_id").gte("date", yearAgo).order("id").range(a, b)),
  ]);

  const gross = (e: { amount: number; tax_rate: number }) => Number(e.amount) * (1 + Number(e.tax_rate) / 100);
  const ms = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
  const all = recent ?? [];
  const thisMonth = all.filter((e) => e.date >= ms).reduce((s, e) => s + gross(e), 0);
  const unbilled = all.filter((e) => e.is_billable && !e.invoice_id && e.customer_id).reduce((s, e) => s + gross(e), 0);
  const total12 = all.reduce((s, e) => s + gross(e), 0);
  const byCat = (cats ?? [])
    .map((c) => ({ ...c, total: all.filter((e) => e.category_id === c.id).reduce((s, e) => s + gross(e), 0) }))
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total);
  const maxCat = Math.max(1, ...byCat.map((c) => c.total));

  const href = (patch: Partial<SP>) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...patch, page: undefined })) if (v) next.set(k, v);
    const qs = next.toString();
    return qs ? `/expenses?${qs}` : "/expenses";
  };
  const pill = (active: boolean) =>
    cn("rounded-full px-3 py-1 text-xs font-medium", active ? "bg-ink-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50");

  return (
    <>
      <PageHeader
        title="Expenses"
        description="What the business spends, by category — and what can be re-billed."
        actions={can("expenses", "edit") && <LinkButton href="/expenses/new"><Plus className="h-4 w-4" /> New expense</LinkButton>}
      />
      <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_1fr_1fr_1.4fr]">
        {[
          ["This month", thisMonth, "text-slate-900"],
          ["Last 12 months", total12, "text-slate-900"],
          ["Billable, not invoiced", unbilled, "text-amber-600"],
        ].map(([l, v, tone]) => (
          <Card key={l as string} className="px-5 py-4">
            <div className="text-xs font-medium text-slate-500">{l}</div>
            <div className={cn("mt-1 text-xl font-bold", tone as string)}>{formatMoney(v as number)}</div>
          </Card>
        ))}
        <Card>
          <CardHeader title="By category" description="Last 12 months, incl. tax" className="py-3" />
          <CardBody className="space-y-2 py-3">
            {byCat.slice(0, 4).map((c) => (
              <div key={c.id} className="text-xs">
                <div className="mb-0.5 flex justify-between"><span className="text-slate-600">{c.name}</span><span className="font-medium">{formatMoney(c.total)}</span></div>
                <div className="h-1.5 rounded-full bg-slate-100"><div className="h-1.5 rounded-full bg-brand-500" style={{ width: `${(c.total / maxCat) * 100}%` }} /></div>
              </div>
            ))}
            {!byCat.length && <p className="text-xs text-slate-400">No expenses yet.</p>}
          </CardBody>
        </Card>
      </div>

      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-1.5">
            <Link href={href({ category: undefined, billable: undefined })} className={pill(!sp.category && !sp.billable)}>All</Link>
            <Link href={href({ billable: sp.billable === "pending" || sp.billable === "1" ? undefined : "pending" })} className={pill(sp.billable === "pending" || sp.billable === "1")}>Pending billing</Link>
            <Link href={href({ billable: sp.billable === "billed" ? undefined : "billed" })} className={pill(sp.billable === "billed")}>Billed</Link>
            <span className="mx-1 h-5 w-px bg-slate-200" />
            {cats?.map((c) => (
              <Link key={c.id} href={href({ category: sp.category === String(c.id) ? undefined : String(c.id) })} className={pill(sp.category === String(c.id))}>{c.name}</Link>
            ))}
          </div>
          <SearchInput placeholder="Search expenses…" />
        </div>
        {!rows?.length ? (
          <EmptyState icon={Receipt} title="No expenses" description="Log travel, software, supplies and more." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Expense</th>
                    <th className="hidden md:table-cell">Category</th>
                    <th className="hidden md:table-cell">Date</th>
                    <th className="hidden lg:table-cell">Customer</th>
                    <th className="text-right">Amount</th>
                    <th>Billing</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((e) => (
                    <tr key={e.id}>
                      <td>
                        <Link href={`/expenses/${e.id}`} className="font-medium text-slate-900 hover:text-brand-700">{e.name}</Link>
                        {(e.recurring_every || e.recurring_from) && <Repeat className={`ml-1.5 inline h-3.5 w-3.5 ${e.recurring_every ? "text-violet-600" : "text-slate-400"}`} aria-label={e.recurring_every ? "Repeats" : "Recurring copy"} />}
                        {e.receipt_path && <Paperclip className="ml-1 inline h-3.5 w-3.5 text-slate-400" aria-label="Receipt attached" />}
                        {e.reference && <div className="text-xs text-slate-400">{e.reference}</div>}
                      </td>
                      <td className="hidden text-slate-600 md:table-cell">{e.category?.name ?? "—"}</td>
                      <td className="hidden whitespace-nowrap text-slate-600 md:table-cell">{formatDate(e.date)}</td>
                      <td className="hidden lg:table-cell">{e.customer ? <Link href={`/customers/${e.customer.id}`} className="text-slate-700 hover:text-brand-700">{e.customer.company}</Link> : <span className="text-slate-400">Internal</span>}</td>
                      <td className="whitespace-nowrap text-right">
                        <div className="font-semibold">{formatMoney(gross(e))}</div>
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
            <Pagination page={page} pageSize={PAGE_SIZE} total={count ?? 0} basePath="/expenses" params={{ q: sp.q, category: sp.category, billable: sp.billable }} />
          </>
        )}
      </Card>
    </>
  );
}
