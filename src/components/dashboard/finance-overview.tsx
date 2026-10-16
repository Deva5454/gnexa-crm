import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/card";
import { requireStaff } from "@/lib/auth";
import { salesOverview } from "@/lib/dashboard-data";
import { monthStartIST } from "@/lib/dates";
import { allRows } from "@/lib/fetch-all";
import { KINDS, STATUS_FILTERS } from "@/lib/sales";
import { toBase } from "@/lib/sales-data";
import { cn, formatMoney } from "@/lib/utils";

// One bar color per status meaning, shared across the three columns
const BAR: Record<string, string> = {
  draft: "bg-slate-400",
  sent: "bg-sky-500",
  unpaid: "bg-sky-500",
  partial: "bg-amber-500",
  overdue: "bg-rose-500",
  expired: "bg-amber-500",
  declined: "bg-rose-500",
  accepted: "bg-emerald-500",
  paid: "bg-emerald-500",
  cancelled: "bg-slate-700",
};

/** Perfex "Finance overview": invoice, estimate and proposal counts by status, and the money totals. */
export async function FinanceOverview({ className }: { className?: string }) {
  const { supabase, can } = await requireStaff();
  const sales = await salesOverview();
  if (!sales) return null;
  const ms = monthStartIST();
  const [{ data: pays }, { data: exps }] = await Promise.all([
    allRows((a, b) => supabase.from("payments").select("amount, invoice:sales_docs(exchange_rate)").gte("date", ms).order("id").range(a, b)),
    can("expenses", "view") ? allRows((a, b) => supabase.from("expenses").select("amount, tax_rate").gte("date", ms).order("id").range(a, b)) : Promise.resolve({ data: null }),
  ]);
  const collected = pays.reduce((s, p) => s + toBase(Number(p.amount), p.invoice?.exchange_rate), 0);
  const spent = exps ? exps.reduce((s, e) => s + Number(e.amount) * (1 + Number(e.tax_rate) / 100), 0) : null;
  const cur = sales.currency;

  const money = [
    { label: "Outstanding invoices", value: sales.outstanding, tone: "text-slate-900", href: "/sales/invoices?status=unpaid" },
    { label: "Past due invoices", value: sales.pastDue, tone: "text-rose-600", href: "/sales/invoices?status=overdue" },
    { label: "Paid invoices", value: sales.paid, tone: "text-emerald-600", href: "/sales/invoices?status=paid" },
    { label: "Collected this month", value: collected, tone: "text-emerald-600", href: "/sales/payments" },
    ...(spent != null ? [{ label: "Spent this month", value: spent, tone: "text-amber-600", href: "/expenses" }] : []),
  ];

  return (
    <Card className={className}>
      <CardHeader title="Finance overview" description={`Totals in ${cur}`} />
      <div className="grid divide-y divide-slate-100 md:grid-cols-3 md:divide-x md:divide-y-0">
        {(["invoice", "estimate", "proposal"] as const).map((kind) => {
          const o = sales.overview[kind];
          return (
            <section key={kind} className="space-y-2.5 p-5" aria-label={`${KINDS[kind].label} overview`}>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{KINDS[kind].label} overview</h4>
              {STATUS_FILTERS[kind].map((f) => {
                const n = o.counts[f.key] ?? 0;
                const pct = o.total ? Math.round((n / o.total) * 100) : 0;
                return (
                  <Link key={f.key} href={`/sales/${KINDS[kind].slug}?status=${f.key}`} className="block rounded-md px-1 py-0.5 hover:bg-slate-50">
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="font-medium text-slate-700">{f.label}</span>
                      <span className="text-slate-500">
                        {n} <span className="text-slate-400">/ {o.total}</span> · {pct}%
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100">
                      <div className={cn("h-1.5 rounded-full", BAR[f.key] ?? "bg-brand-500")} style={{ width: `${pct}%` }} />
                    </div>
                  </Link>
                );
              })}
            </section>
          );
        })}
      </div>
      <div className="grid gap-px border-t border-slate-100 bg-slate-100 sm:grid-cols-3 lg:grid-cols-5">
        {money.map((m) => (
          <Link key={m.label} href={m.href} className="bg-white px-5 py-3 hover:bg-slate-50">
            <div className="text-xs font-medium text-slate-500">{m.label}</div>
            <div className={cn("text-base font-bold", m.tone)}>{formatMoney(m.value, cur)}</div>
          </Link>
        ))}
      </div>
    </Card>
  );
}
