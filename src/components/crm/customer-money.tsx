import Link from "next/link";
import { Plus } from "lucide-react";
import { LinkButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { requireStaff } from "@/lib/auth";
import { docHref, docNumber } from "@/lib/sales";
import { formatDate, formatMoney } from "@/lib/utils";

/** Perfex customer "Payments" tab: every payment received against this customer's invoices. */
export async function CustomerPayments({ customerId }: { customerId: number }) {
  const { supabase, can } = await requireStaff();
  if (!can("sales", "view")) return null;
  const { data } = await supabase
    .from("payments")
    .select("id, amount, date, transaction_id, mode:payment_modes(name), invoice:sales_docs!inner(id, number, currency, customer_id)")
    .eq("invoice.customer_id", customerId)
    .order("date", { ascending: false })
    .limit(100);
  const rows = data ?? [];
  return (
    <Card>
      <CardHeader title="Payments" description={rows.length ? `${rows.length} payment${rows.length === 1 ? "" : "s"}` : undefined} />
      {!rows.length ? (
        <p className="px-5 py-8 text-center text-sm text-slate-400">No payments yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr><th>#</th><th>Invoice</th><th>Mode</th><th className="hidden md:table-cell">Transaction</th><th>Date</th><th className="text-right">Amount</th></tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td className="text-xs text-slate-400">{p.id}</td>
                  <td><Link href={docHref("invoice", p.invoice.id)} className="font-medium text-brand-700">{docNumber("invoice", p.invoice.number)}</Link></td>
                  <td className="text-slate-600">{p.mode?.name ?? "—"}</td>
                  <td className="hidden text-slate-500 md:table-cell">{p.transaction_id ?? "—"}</td>
                  <td className="text-slate-600">{formatDate(p.date)}</td>
                  <td className="text-right font-semibold text-emerald-700">{formatMoney(Number(p.amount), p.invoice.currency ?? "INR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/** Perfex customer "Expenses" tab: all expenses recorded against this customer, billed or not. */
export async function CustomerExpenses({ customerId }: { customerId: number }) {
  const { supabase, can } = await requireStaff();
  if (!can("expenses", "view")) return null;
  const { data } = await supabase
    .from("expenses")
    .select("id, name, amount, tax_rate, date, is_billable, category:expense_categories(name), invoice:sales_docs(id, number)")
    .eq("customer_id", customerId)
    .order("date", { ascending: false })
    .limit(100);
  const rows = data ?? [];
  return (
    <Card>
      <CardHeader
        title="Expenses"
        description={rows.length ? `${rows.length} expense${rows.length === 1 ? "" : "s"}` : undefined}
        action={can("expenses", "edit") && <LinkButton href={`/expenses/new?customer=${customerId}`} size="sm" variant="secondary"><Plus className="h-3.5 w-3.5" /> Expense</LinkButton>}
      />
      {!rows.length ? (
        <p className="px-5 py-8 text-center text-sm text-slate-400">No expenses for this customer.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr><th>Expense</th><th className="hidden md:table-cell">Category</th><th>Date</th><th>Billing</th><th className="text-right">Amount</th></tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id}>
                  <td><Link href={`/expenses/${e.id}`} className="font-medium text-slate-800 hover:text-brand-700">{e.name}</Link></td>
                  <td className="hidden text-slate-600 md:table-cell">{e.category?.name ?? "—"}</td>
                  <td className="text-slate-600">{formatDate(e.date)}</td>
                  <td>
                    {e.invoice ? (
                      <Link href={docHref("invoice", e.invoice.id)}><Badge className="bg-emerald-50 text-emerald-700 ring-emerald-200">Invoiced · {docNumber("invoice", e.invoice.number)}</Badge></Link>
                    ) : e.is_billable ? (
                      <Badge className="bg-amber-50 text-amber-700 ring-amber-200">Not invoiced yet</Badge>
                    ) : (
                      <span className="text-xs text-slate-400">Not billable</span>
                    )}
                  </td>
                  <td className="text-right font-semibold">{formatMoney(Number(e.amount) * (1 + Number(e.tax_rate) / 100))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
