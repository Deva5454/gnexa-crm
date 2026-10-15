import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Wallet } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { requireStaff } from "@/lib/auth";
import { docHref, docNumber } from "@/lib/sales";
import { cn, formatDate, formatMoney, PAGE_SIZE } from "@/lib/utils";

export const metadata: Metadata = { title: "Payments" };

type SP = { mode?: string; page?: string };

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const { supabase, can } = await requireStaff();
  if (!can("sales", "view")) notFound();

  let q = supabase
    .from("payments")
    .select("id, amount, date, transaction_id, note, mode:payment_modes(name), invoice:sales_docs(id, number, currency, customer:customers(id, company))", { count: "exact" })
    .order("date", { ascending: false })
    .order("id", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (sp.mode) q = q.eq("mode_id", Number(sp.mode));

  const monthStart = new Date();
  monthStart.setDate(1);
  const [{ data: rows, count }, { data: modes }, { data: recent }] = await Promise.all([
    q,
    supabase.from("payment_modes").select("id, name").order("id"),
    supabase.from("payments").select("amount, date").gte("date", new Date(Date.now() - 365 * 86400_000).toISOString().slice(0, 10)),
  ]);
  const ms = monthStart.toISOString().slice(0, 10);
  const thisMonth = (recent ?? []).filter((r) => r.date >= ms).reduce((s, r) => s + Number(r.amount), 0);
  const last30 = (recent ?? []).filter((r) => r.date >= new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10)).reduce((s, r) => s + Number(r.amount), 0);
  const year = (recent ?? []).reduce((s, r) => s + Number(r.amount), 0);

  const pill = (active: boolean) =>
    cn("rounded-full px-3 py-1 text-xs font-medium", active ? "bg-ink-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50");

  return (
    <>
      <PageHeader title="Payments" description="Money received against invoices." />
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {[
          ["This month", thisMonth],
          ["Last 30 days", last30],
          ["Last 12 months", year],
        ].map(([l, v]) => (
          <Card key={l as string} className="px-5 py-4">
            <div className="text-xs font-medium text-slate-500">{l}</div>
            <div className="mt-1 text-xl font-bold text-emerald-600">{formatMoney(v as number)}</div>
          </Card>
        ))}
      </div>
      <Card>
        <div className="flex flex-wrap gap-1.5 border-b border-slate-100 p-4">
          <Link href="/sales/payments" className={pill(!sp.mode)}>All modes</Link>
          {modes?.map((m) => (
            <Link key={m.id} href={`/sales/payments?mode=${m.id}`} className={pill(sp.mode === String(m.id))}>{m.name}</Link>
          ))}
        </div>
        {!rows?.length ? (
          <EmptyState icon={Wallet} title="No payments yet" description="Record a payment from any invoice." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Invoice</th>
                    <th>Customer</th>
                    <th className="hidden md:table-cell">Mode</th>
                    <th className="hidden lg:table-cell">Reference</th>
                    <th className="text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td className="whitespace-nowrap text-slate-600">{formatDate(r.date)}</td>
                      <td>
                        {r.invoice && (
                          <Link href={docHref("invoice", r.invoice.id)} className="font-mono font-semibold text-brand-700 hover:underline">
                            {docNumber("invoice", r.invoice.number)}
                          </Link>
                        )}
                      </td>
                      <td>
                        {r.invoice?.customer && (
                          <Link href={`/customers/${r.invoice.customer.id}`} className="text-slate-800 hover:text-brand-700">{r.invoice.customer.company}</Link>
                        )}
                      </td>
                      <td className="hidden text-slate-600 md:table-cell">{r.mode?.name ?? "—"}</td>
                      <td className="hidden text-slate-500 lg:table-cell">{r.transaction_id ?? "—"}</td>
                      <td className="whitespace-nowrap text-right font-semibold text-emerald-700">{formatMoney(Number(r.amount), r.invoice?.currency ?? "INR")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pageSize={PAGE_SIZE} total={count ?? 0} basePath="/sales/payments" params={{ mode: sp.mode }} />
          </>
        )}
      </Card>
    </>
  );
}
