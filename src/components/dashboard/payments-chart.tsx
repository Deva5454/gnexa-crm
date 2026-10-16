import Link from "next/link";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { requireStaff } from "@/lib/auth";
import { daysFromToday, todayIST } from "@/lib/dates";
import { allRows } from "@/lib/fetch-all";
import { baseCurrency, toBase } from "@/lib/sales-data";
import { formatMoney } from "@/lib/utils";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Perfex "Payment records": money received per day, this week against last week (base currency). */
export async function PaymentsChart({ className }: { className?: string }) {
  const { supabase, can } = await requireStaff();
  if (!can("sales", "view")) return null;
  const today = todayIST();
  const dow = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7; // 0 = Monday
  const lastMon = daysFromToday(-dow - 7);
  const [{ data: pays }, cur] = await Promise.all([
    allRows((a, b) => supabase.from("payments").select("date, amount, invoice:sales_docs(exchange_rate)").gte("date", lastMon).lte("date", daysFromToday(6 - dow)).order("id").range(a, b)),
    baseCurrency(supabase),
  ]);

  const thisWeek = Array(7).fill(0) as number[];
  const lastWeek = Array(7).fill(0) as number[];
  for (const p of pays) {
    const diff = Math.round((Date.parse(`${p.date}T00:00:00Z`) - Date.parse(`${lastMon}T00:00:00Z`)) / 86400_000);
    const amt = toBase(Number(p.amount), p.invoice?.exchange_rate);
    if (diff >= 0 && diff < 7) lastWeek[diff]! += amt;
    else if (diff >= 7 && diff < 14) thisWeek[diff - 7]! += amt;
  }
  const max = Math.max(1, ...thisWeek, ...lastWeek);
  const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
  const tw = sum(thisWeek);
  const lw = sum(lastWeek);
  const change = lw ? Math.round(((tw - lw) / lw) * 100) : null;
  const fmt = (n: number) => formatMoney(n, cur);

  return (
    <Card className={className}>
      <CardHeader
        title="Payment records"
        description={`This week vs last week · ${cur}`}
        action={<Link href="/sales/payments" className="text-xs font-semibold text-brand-600 hover:text-brand-700">All payments →</Link>}
      />
      <CardBody>
        <div className="mb-4 flex flex-wrap items-end gap-6">
          <div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500"><span className="h-2.5 w-2.5 rounded-sm bg-brand-600" />This week</div>
            <div className="text-xl font-bold text-slate-900">{fmt(tw)}</div>
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500"><span className="h-2.5 w-2.5 rounded-sm bg-slate-300" />Last week</div>
            <div className="text-xl font-bold text-slate-500">{fmt(lw)}</div>
          </div>
          {change != null && (
            <div className={`text-sm font-semibold ${change >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
              {change >= 0 ? "▲" : "▼"} {Math.abs(change)}% <span className="font-normal text-slate-400">vs last week</span>
            </div>
          )}
        </div>
        <div className="relative h-40 border-b border-slate-200" aria-hidden>
          {[0.5, 1].map((f) => (
            <div key={f} className="absolute inset-x-0 border-t border-dashed border-slate-100" style={{ bottom: `${f * 100}%` }} />
          ))}
          <div className="absolute inset-0 flex items-end gap-2 sm:gap-4">
            {DAYS.map((d, i) => (
              <div key={d} className="group relative flex h-full flex-1 items-end justify-center gap-0.5">
                <div className="w-1/3 max-w-4 rounded-t bg-slate-300" style={{ height: `${(lastWeek[i]! / max) * 100}%`, minHeight: lastWeek[i] ? 3 : 0 }} />
                <div className="w-1/3 max-w-4 rounded-t bg-brand-600" style={{ height: `${(thisWeek[i]! / max) * 100}%`, minHeight: thisWeek[i] ? 3 : 0 }} />
                <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-ink-900 px-2.5 py-1.5 text-[11px] text-white shadow-lg group-hover:block">
                  <div className="font-semibold">{d}</div>
                  <div>This week: {fmt(thisWeek[i]!)}</div>
                  <div className="text-slate-300">Last week: {fmt(lastWeek[i]!)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-1.5 flex gap-2 text-center text-[11px] text-slate-400 sm:gap-4" aria-hidden>
          {DAYS.map((d, i) => <span key={d} className={`flex-1 ${i === dow ? "font-semibold text-slate-700" : ""}`}>{d}</span>)}
        </div>
        <table className="sr-only">
          <caption>Payments received per day</caption>
          <thead><tr><th>Day</th><th>This week</th><th>Last week</th></tr></thead>
          <tbody>
            {DAYS.map((d, i) => <tr key={d}><td>{d}</td><td>{fmt(thisWeek[i]!)}</td><td>{fmt(lastWeek[i]!)}</td></tr>)}
          </tbody>
        </table>
      </CardBody>
    </Card>
  );
}
