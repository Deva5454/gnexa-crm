import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowDown, ArrowUp, Download, Printer, Wallet } from "lucide-react";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { ParamSelect } from "@/components/ui/param-select";
import { SearchInput } from "@/components/ui/search-input";
import { requireStaff } from "@/lib/auth";
import { allRows } from "@/lib/fetch-all";
import { docHref, docNumber, receiptNumber } from "@/lib/sales";
import { cn, formatDate, formatMoney, PAGE_SIZE, searchTerm } from "@/lib/utils";
import { daysFromToday, monthStartIST, PERIODS, periodRange } from "@/lib/dates";
import { baseCurrency, toBase } from "@/lib/sales-data";

export const metadata: Metadata = { title: "Payments" };

type SP = { q?: string; mode?: string; customer?: string; period?: string; sort?: string; dir?: string; page?: string };

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const { supabase, can } = await requireStaff();
  if (!can("sales", "view")) notFound();

  // Search: receipt number, invoice number, transaction / UTR no., note or customer name
  const term = sp.q ? searchTerm(sp.q) : "";
  const n = /^(?:rcpt|inv)?[-\s#]*0*(\d{1,9})$/i.exec(term)?.[1];
  let searchInvoices: number[] = [];
  if (term) {
    const [{ data: byNumber }, { data: byCustomer }] = await Promise.all([
      n ? supabase.from("sales_docs").select("id").eq("kind", "invoice").eq("number", Number(n)) : Promise.resolve({ data: [] as { id: number }[] }),
      supabase.from("sales_docs").select("id, customer:customers!inner(company)").eq("kind", "invoice").ilike("customer.company", `%${term}%`).limit(500),
    ]);
    searchInvoices = [...new Set([...(byNumber ?? []), ...(byCustomer ?? [])].map((d) => d.id))];
  }
  const customerInvoices = Number(sp.customer)
    ? ((await supabase.from("sales_docs").select("id").eq("kind", "invoice").eq("customer_id", Number(sp.customer)).limit(2000)).data ?? []).map((d) => d.id)
    : null;

  const range = periodRange(sp.period);
  const { data: matched } = await allRows((a, b) => {
    let q = supabase.from("payments").select("id, amount, date, invoice:sales_docs(exchange_rate)").order("id").range(a, b);
    if (term) {
      const ors = [`transaction_id.ilike.%${term}%`, `note.ilike.%${term}%`];
      if (n) ors.push(`id.eq.${Number(n)}`);
      if (searchInvoices.length) ors.push(`invoice_id.in.(${searchInvoices.join(",")})`);
      q = q.or(ors.join(","));
    }
    if (customerInvoices) q = q.in("invoice_id", customerInvoices.length ? customerInvoices : [0]);
    if (Number(sp.mode)) q = q.eq("mode_id", Number(sp.mode));
    if (range) q = q.gte("date", range[0]).lte("date", range[1]);
    return q;
  });

  const all = matched ?? [];
  const inBase = (r: { amount: number; invoice: { exchange_rate: number } | null }) => toBase(Number(r.amount), r.invoice?.exchange_rate);
  const byAmount = sp.sort === "amount";
  const asc = sp.dir === "asc";
  const sorted = [...all].sort((x, y) => {
    const d = byAmount ? inBase(x) - inBase(y) : x.date.localeCompare(y.date) || x.id - y.id;
    return asc ? d : -d;
  });
  const pageIds = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((p) => p.id);

  const [{ data: details }, { data: modes }, { data: customers }, { data: recent }, base] = await Promise.all([
    pageIds.length
      ? supabase.from("payments").select("id, amount, date, transaction_id, mode:payment_modes(name), invoice:sales_docs(id, number, currency, customer:customers(id, company))").in("id", pageIds)
      : Promise.resolve({ data: [] }),
    supabase.from("payment_modes").select("id, name").order("id"),
    supabase.from("customers").select("id, company").order("company").limit(1000),
    supabase.from("payments").select("amount, date, invoice:sales_docs(exchange_rate)").gte("date", daysFromToday(-365)),
    baseCurrency(supabase),
  ]);
  const rows = pageIds.map((id) => details?.find((d) => d.id === id)).filter((r): r is NonNullable<typeof r> => !!r);

  const ms = monthStartIST();
  const sum = (list: { amount: number; invoice: { exchange_rate: number } | null }[]) => list.reduce((s, r) => s + inBase(r), 0);
  const filtered = Boolean(term || sp.mode || sp.customer || sp.period);
  const tiles: [string, number, string?][] = [
    ["This month", sum((recent ?? []).filter((r) => r.date >= ms))],
    ["Last 30 days", sum((recent ?? []).filter((r) => r.date >= daysFromToday(-30)))],
    ["Last 12 months", sum(recent ?? [])],
    ...(filtered ? ([["Matching filters", sum(all), `${all.length} payment${all.length === 1 ? "" : "s"}`]] as [string, number, string][]) : []),
  ];

  const href = (patch: Partial<SP>) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...patch, page: undefined })) if (v) next.set(k, v);
    const qs = next.toString();
    return qs ? `/sales/payments?${qs}` : "/sales/payments";
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

  return (
    <>
      <PageHeader
        title="Payments"
        description="Money received against invoices."
        actions={
          <>
            <LinkButton href={range ? `/csv-export/payments?from=${range[0]}&to=${range[1]}` : "/csv-export/payments"} variant="secondary"><Download className="h-4 w-4" /> Export</LinkButton>
            {can("sales", "edit") && <LinkButton href="/sales/payments/batch" variant="secondary"><Wallet className="h-4 w-4" /> Batch payments</LinkButton>}
          </>
        }
      />
      <div className={cn("mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3", filtered && "sm:grid-cols-2 lg:grid-cols-4")}>
        {tiles.map(([l, v, sub]) => (
          <Card key={l} className="px-5 py-4">
            <div className="text-xs font-medium text-slate-500">{l}</div>
            <div className="mt-1 text-xl font-bold text-emerald-600">{formatMoney(v, base)}</div>
            {sub && <div className="text-[11px] text-slate-400">{sub}</div>}
          </Card>
        ))}
      </div>
      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-1.5">
            <ParamSelect name="period" label="Period" allLabel="All time" options={PERIODS} />
            <ParamSelect name="mode" label="Payment mode" allLabel="Any payment mode" options={(modes ?? []).map((m) => ({ value: String(m.id), label: m.name }))} />
            <ParamSelect name="customer" label="Customer" allLabel="Any customer" options={(customers ?? []).map((c) => ({ value: String(c.id), label: c.company }))} />
          </div>
          <SearchInput placeholder="Receipt, invoice, UTR or customer…" />
        </div>
        {!rows.length ? (
          <EmptyState icon={Wallet} title={filtered ? "No matching payments" : "No payments yet"} description={filtered ? "Nothing matches these filters." : "Record a payment from any invoice."} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Payment</th>
                    <th>Invoice</th>
                    <th className="hidden sm:table-cell">Customer</th>
                    <th className="hidden md:table-cell">Mode</th>
                    <th className="hidden lg:table-cell">Transaction / UTR</th>
                    <th className="hidden md:table-cell">{sortLink("date", "Date")}</th>
                    <th className="text-right">{sortLink("amount", "Amount", "justify-end")}</th>
                    <th className="w-10"><span className="sr-only">Receipt</span></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td className="whitespace-nowrap">
                        <Link href={`/sales/payments/${r.id}`} className="font-mono font-semibold text-brand-700 hover:underline">{receiptNumber(r.id)}</Link>
                        <div className="text-xs text-slate-400 md:hidden">{formatDate(r.date)}</div>
                      </td>
                      <td className="whitespace-nowrap">
                        {r.invoice && (
                          <Link href={docHref("invoice", r.invoice.id)} className="font-mono text-slate-700 hover:text-brand-700">
                            {docNumber("invoice", r.invoice.number)}
                          </Link>
                        )}
                      </td>
                      <td className="hidden sm:table-cell">
                        {r.invoice?.customer && (
                          <Link href={`/customers/${r.invoice.customer.id}`} className="text-slate-800 hover:text-brand-700">{r.invoice.customer.company}</Link>
                        )}
                      </td>
                      <td className="hidden text-slate-600 md:table-cell">{r.mode?.name ?? "—"}</td>
                      <td className="hidden text-slate-500 lg:table-cell">{r.transaction_id ?? "—"}</td>
                      <td className="hidden whitespace-nowrap text-slate-600 md:table-cell">{formatDate(r.date)}</td>
                      <td className="whitespace-nowrap text-right font-semibold text-emerald-700">{formatMoney(Number(r.amount), r.invoice?.currency ?? base)}</td>
                      <td>
                        <a href={`/print/receipt/${r.id}`} target="_blank" rel="noreferrer" className="inline-flex rounded p-1 text-slate-400 hover:text-brand-700" aria-label={`Receipt PDF ${receiptNumber(r.id)}`} title="Payment receipt (PDF)">
                          <Printer className="h-4 w-4" />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pageSize={PAGE_SIZE} total={all.length} basePath="/sales/payments" params={{ q: sp.q, mode: sp.mode, customer: sp.customer, period: sp.period, sort: sp.sort, dir: sp.dir }} />
          </>
        )}
      </Card>
    </>
  );
}
