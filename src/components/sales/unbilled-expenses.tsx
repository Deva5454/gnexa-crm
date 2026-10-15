import Link from "next/link";
import { FilePlus2, Receipt } from "lucide-react";
import { LinkButton } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { requireStaff } from "@/lib/auth";
import { formatDate, formatMoney } from "@/lib/utils";

/** Billable expenses for a customer that haven't been invoiced yet. Renders nothing when there are none. */
export async function UnbilledExpenses({ customerId }: { customerId: number }) {
  const { supabase, can } = await requireStaff();
  if (!can("expenses", "view")) return null;
  const { data: exps } = await supabase
    .from("expenses")
    .select("id, name, date, amount, tax_rate, category:expense_categories(name)")
    .eq("customer_id", customerId)
    .eq("is_billable", true)
    .is("invoice_id", null)
    .order("date");
  if (!exps?.length) return null;
  const total = exps.reduce((s, e) => s + Number(e.amount) * (1 + Number(e.tax_rate) / 100), 0);
  return (
    <Card className="border-amber-200">
      <CardHeader
        title={<span className="flex items-center gap-2"><Receipt className="h-4 w-4 text-amber-500" /> Pending billing · {formatMoney(total)}</span>}
        description={`${exps.length} billable expense${exps.length === 1 ? "" : "s"} not on an invoice yet`}
        action={can("sales", "edit") && <LinkButton href={`/sales/invoices/new?customer=${customerId}`} size="sm" variant="accent"><FilePlus2 className="h-3.5 w-3.5" /> Invoice them</LinkButton>}
      />
      <ul className="divide-y divide-slate-100">
        {exps.map((e) => (
          <li key={e.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
            <Link href={`/expenses/${e.id}`} className="min-w-0 flex-1 truncate font-medium text-slate-800 hover:text-brand-700">{e.name}</Link>
            <span className="hidden text-xs text-slate-500 sm:inline">{e.category?.name ?? "—"} · {formatDate(e.date)}</span>
            <b>{formatMoney(Number(e.amount) * (1 + Number(e.tax_rate) / 100))}</b>
          </li>
        ))}
      </ul>
    </Card>
  );
}
