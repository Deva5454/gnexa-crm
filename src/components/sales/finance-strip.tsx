import Link from "next/link";
import { AlertTriangle, Banknote, Receipt, Wallet } from "lucide-react";
import { Card } from "@/components/ui/card";
import { requireStaff } from "@/lib/auth";
import { docStatus } from "@/lib/sales";
import { balancesFor } from "@/lib/sales-data";
import { formatMoney } from "@/lib/utils";

/** Money at a glance for the dashboard; hidden for roles without sales access. */
export async function FinanceStrip() {
  const { supabase, can } = await requireStaff();
  if (!can("sales", "view")) return null;
  const today = new Date().toISOString().slice(0, 10);
  const ms = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

  const [{ data: invs }, { data: pays }, { data: exps }] = await Promise.all([
    supabase.from("sales_docs").select("id, kind, status, due_date, total").eq("kind", "invoice").in("status", ["sent", "accepted"]),
    supabase.from("payments").select("amount").gte("date", ms),
    can("expenses", "view") ? supabase.from("expenses").select("amount, tax_rate").gte("date", ms) : Promise.resolve({ data: null }),
  ]);
  const bals = await balancesFor(supabase, (invs ?? []).map((i) => i.id));
  let outstanding = 0;
  let overdue = 0;
  let overdueCount = 0;
  for (const i of invs ?? []) {
    const b = bals.get(i.id);
    const st = docStatus({ kind: "invoice", status: i.status, due_date: i.due_date, total: Number(i.total) }, b, today);
    const left = Math.max(0, b?.balance ?? Number(i.total));
    outstanding += left;
    if (st.key === "overdue") {
      overdue += left;
      overdueCount++;
    }
  }
  const collected = (pays ?? []).reduce((s, p) => s + Number(p.amount), 0);
  const spent = exps ? exps.reduce((s, e) => s + Number(e.amount) * (1 + Number(e.tax_rate) / 100), 0) : null;

  const tiles = [
    { label: "Invoices outstanding", value: formatMoney(outstanding), icon: Banknote, tone: "text-slate-900", href: "/sales/invoices?status=unpaid" },
    { label: `Overdue · ${overdueCount} invoice${overdueCount === 1 ? "" : "s"}`, value: formatMoney(overdue), icon: AlertTriangle, tone: "text-rose-600", href: "/sales/invoices?status=overdue" },
    { label: "Collected this month", value: formatMoney(collected), icon: Wallet, tone: "text-emerald-600", href: "/sales/payments" },
    ...(spent != null ? [{ label: "Spent this month", value: formatMoney(spent), icon: Receipt, tone: "text-amber-600", href: "/expenses" }] : []),
  ];
  return (
    <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {tiles.map((t) => (
        <Link key={t.label} href={t.href}>
          <Card className="flex items-center gap-4 px-5 py-4 transition hover:border-brand-200">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
              <t.icon className="h-4 w-4" />
            </div>
            <div>
              <div className="text-xs font-medium text-slate-500">{t.label}</div>
              <div className={`text-lg font-bold ${t.tone}`}>{t.value}</div>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}
