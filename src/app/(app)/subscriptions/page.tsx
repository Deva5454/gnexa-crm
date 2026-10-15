import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock, CreditCard, Plus, Repeat } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireStaff } from "@/lib/auth";
import { INTERVAL_LABEL } from "@/lib/sales";
import { cn, formatDate, formatMoney } from "@/lib/utils";
import { monthly, SUB_STATUS, withTax } from "./status";

export const metadata: Metadata = { title: "Subscriptions" };

export default async function SubscriptionsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const sp = await searchParams;
  const { supabase, can } = await requireStaff();
  if (!can("sales", "view")) notFound();
  await supabase.rpc("run_recurring");
  const { data: all } = await supabase
    .from("subscriptions")
    .select("id, name, status, quantity, unit_price, tax_rate, currency, interval_count, interval_unit, next_billing_date, cycles_billed, ends_after_cycles, auto_charge, customer:customers(id, company)")
    .order("status")
    .order("next_billing_date", { ascending: true, nullsFirst: false });
  const subs = (all ?? []).filter((s) => (sp.status ? s.status === sp.status : s.status === "active" || s.status === "paused"));
  const active = (all ?? []).filter((s) => s.status === "active");
  const mrr = active.reduce((t, s) => t + monthly(s), 0);
  const next = active.filter((s) => s.next_billing_date).sort((a, b) => a.next_billing_date!.localeCompare(b.next_billing_date!))[0];
  const pill = (on: boolean) => cn("rounded-full px-3 py-1 text-xs font-medium", on ? "bg-ink-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50");

  return (
    <>
      <PageHeader
        title="Subscriptions"
        description="Recurring plans that raise an invoice every billing period."
        actions={can("sales", "edit") && <LinkButton href="/subscriptions/new"><Plus className="h-4 w-4" /> New subscription</LinkButton>}
      />
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Card className="px-5 py-4">
          <div className="text-xs font-medium text-slate-500">Monthly recurring revenue</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{formatMoney(mrr)}</div>
          <div className="text-xs text-slate-400">before GST · {active.length} active plan{active.length === 1 ? "" : "s"}</div>
        </Card>
        <Card className="px-5 py-4">
          <div className="text-xs font-medium text-slate-500">Annual run-rate</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{formatMoney(mrr * 12)}</div>
          <div className="text-xs text-slate-400">MRR × 12</div>
        </Card>
        <Card className="px-5 py-4">
          <div className="text-xs font-medium text-slate-500">Next billing</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{next ? formatDate(next.next_billing_date) : "—"}</div>
          <div className="truncate text-xs text-slate-400">{next ? `${next.customer?.company} · ${next.name}` : "Nothing scheduled"}</div>
        </Card>
      </div>
      <Card>
        <div className="flex flex-wrap gap-1.5 border-b border-slate-100 p-4">
          <Link href="/subscriptions" className={pill(!sp.status)}>Current</Link>
          {Object.entries(SUB_STATUS).map(([k, v]) => (
            <Link key={k} href={`/subscriptions?status=${k}`} className={pill(sp.status === k)}>{v.label}</Link>
          ))}
        </div>
        {!subs.length ? (
          <EmptyState icon={Repeat} title="No subscriptions here" description="Bill customers automatically for licences, support plans or hosting." action={can("sales", "edit") && <LinkButton href="/subscriptions/new"><Plus className="h-4 w-4" /> New subscription</LinkButton>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Plan</th>
                  <th>Customer</th>
                  <th className="text-right">Per invoice</th>
                  <th className="hidden md:table-cell">Billing</th>
                  <th className="hidden lg:table-cell">Next invoice</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {subs.map((s) => {
                  const st = SUB_STATUS[s.status] ?? SUB_STATUS.active!;
                  return (
                    <tr key={s.id}>
                      <td>
                        <Link href={`/subscriptions/${s.id}`} className="font-semibold text-slate-900 hover:text-brand-700">{s.name}</Link>
                        {s.auto_charge && <CreditCard className="ml-1.5 inline h-3.5 w-3.5 text-accent-600" aria-label="Auto-charged" />}
                      </td>
                      <td>{s.customer ? <Link href={`/customers/${s.customer.id}`} className="text-slate-600 hover:text-brand-700">{s.customer.company}</Link> : "—"}</td>
                      <td className="text-right font-medium">{formatMoney(withTax(s), s.currency)}</td>
                      <td className="hidden text-slate-600 md:table-cell">Every {INTERVAL_LABEL(s.interval_count, s.interval_unit)} · {s.cycles_billed}{s.ends_after_cycles ? `/${s.ends_after_cycles}` : ""} billed</td>
                      <td className="hidden text-slate-600 lg:table-cell">
                        {s.status === "active" && s.next_billing_date ? <span className="inline-flex items-center gap-1.5"><CalendarClock className="h-3.5 w-3.5 text-slate-400" />{formatDate(s.next_billing_date)}</span> : "—"}
                      </td>
                      <td><Badge className={st.color}>{st.label}</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
