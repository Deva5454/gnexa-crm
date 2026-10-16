import Link from "next/link";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { leadsData } from "@/lib/dashboard-data";
import { daysFromToday } from "@/lib/dates";
import { baseCurrency } from "@/lib/sales-data";
import { requireStaff } from "@/lib/auth";
import { formatMoney } from "@/lib/utils";

/** Perfex "Leads overview": open pipeline by status, win rate, and new leads over the last 14 days. */
export async function LeadsOverview({ className }: { className?: string }) {
  const data = await leadsData();
  if (!data) return null;
  const { supabase } = await requireStaff();
  const currency = await baseCurrency(supabase);
  const all = data.leads;
  const open = all.filter((l) => !l.is_lost && !l.is_junk && !l.converted_customer_id);
  const converted = all.filter((l) => l.converted_customer_id).length;
  const lost = all.filter((l) => l.is_lost && !l.converted_customer_id).length;
  const winRate = converted + lost ? Math.round((converted / (converted + lost)) * 100) : 0;
  const pipeline = open.reduce((s, l) => s + (l.value ?? 0), 0);

  const byStage = data.statuses.map((s) => {
    const items = open.filter((l) => l.status_id === s.id);
    return { ...s, count: items.length, value: items.reduce((a, l) => a + (l.value ?? 0), 0) };
  });
  const maxStage = Math.max(1, ...byStage.map((s) => s.count));

  const start = daysFromToday(-13);
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(`${start}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    const key = d.toISOString().slice(0, 10);
    return { key, label: d.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }), count: 0 };
  });
  const index = new Map(days.map((d, i) => [d.key, i]));
  // created_at is a UTC timestamp; shift to India before taking the date
  for (const l of all) {
    const k = new Date(Date.parse(l.created_at) + 330 * 60_000).toISOString().slice(0, 10);
    const i = index.get(k);
    if (i != null) days[i]!.count++;
  }
  const maxDay = Math.max(1, ...days.map((d) => d.count));
  const fortnight = days.reduce((s, d) => s + d.count, 0);

  return (
    <Card className={className}>
      <CardHeader
        title="Leads overview"
        description={`${open.length} open · ${formatMoney(pipeline, currency)} in the pipeline · ${winRate}% win rate`}
        action={<Link href="/leads" className="text-xs font-semibold text-brand-600 hover:text-brand-700">Open board →</Link>}
      />
      <CardBody className="space-y-3">
        {byStage.map((s) => (
          <div key={s.id} className="grid grid-cols-[110px_1fr_auto] items-center gap-3 text-sm sm:grid-cols-[140px_1fr_120px]">
            <span className="truncate font-medium text-slate-700">{s.name}</span>
            <div className="h-6 overflow-hidden rounded-md bg-slate-100">
              {s.count > 0 && (
                <div
                  className="flex h-full items-center rounded-md px-2 text-xs font-semibold text-white"
                  style={{ width: `${Math.max(8, (s.count / maxStage) * 100)}%`, backgroundColor: s.color }}
                >
                  {s.count}
                </div>
              )}
            </div>
            <span className="text-right text-xs font-medium text-slate-500">{formatMoney(s.value, currency)}</span>
          </div>
        ))}
        {!byStage.length && <p className="py-6 text-center text-sm text-slate-400">No lead statuses yet.</p>}
      </CardBody>
      <div className="border-t border-slate-100 px-5 pb-4 pt-3">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">New leads · last 14 days</span>
          <span className="text-xs text-slate-500">{fortnight} total</span>
        </div>
        <div className="flex h-24 items-end gap-1.5" role="img" aria-label={`New leads per day, last 14 days: ${days.map((d) => `${d.label} ${d.count}`).join(", ")}`}>
          {days.map((d) => (
            <div key={d.key} className="group relative flex h-full flex-1 flex-col items-center justify-end">
              <span className="pointer-events-none absolute -top-5 hidden whitespace-nowrap rounded bg-ink-900 px-1.5 py-0.5 text-[10px] text-white group-hover:block">{d.label}: {d.count}</span>
              <div className="w-full max-w-5 rounded-t bg-brand-500" style={{ height: `${(d.count / maxDay) * 100}%`, minHeight: d.count ? 3 : 0 }} />
            </div>
          ))}
        </div>
        <div className="mt-1 flex gap-1.5 text-center text-[10px] text-slate-400" aria-hidden>
          {days.map((d, i) => <span key={d.key} className="flex-1">{i % 2 === 0 ? d.label.split(" ")[0] : ""}</span>)}
        </div>
      </div>
    </Card>
  );
}

export async function LeadsSources({ className }: { className?: string }) {
  const data = await leadsData();
  if (!data) return null;
  const rows = data.sources
    .map((s) => ({ name: s.name, count: data.leads.filter((l) => l.source_id === s.id).length }))
    .filter((s) => s.count > 0)
    .sort((a, b) => b.count - a.count);
  const max = Math.max(1, ...rows.map((s) => s.count));
  return (
    <Card className={className}>
      <CardHeader title="Leads by source" description={`${data.leads.length} leads in all`} />
      <CardBody className="space-y-3">
        {!rows.length && <p className="py-6 text-center text-sm text-slate-400">No leads yet.</p>}
        {rows.map((s) => (
          <div key={s.name}>
            <div className="mb-1 flex justify-between text-xs">
              <span className="font-medium text-slate-700">{s.name}</span>
              <span className="text-slate-500">{s.count}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100">
              <div className="h-2 rounded-full bg-accent-500" style={{ width: `${(s.count / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}
