import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarX, CreditCard, Repeat, Undo2 } from "lucide-react";
import { SUB_STATUS, withTax } from "@/app/(app)/subscriptions/status";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { EmptyState } from "@/components/ui/empty-state";
import { SubmitButton } from "@/components/ui/submit-button";
import { requirePortal } from "@/lib/auth";
import { INTERVAL_LABEL } from "@/lib/sales";
import { formatDate, formatMoney } from "@/lib/utils";
import { portalSubscriptionEnd } from "../actions";

export const metadata: Metadata = { title: "Subscriptions" };

/** The client's plans (RLS limits this to their own), with Perfex-style "cancel at period end". */
export default async function PortalSubscriptionsPage() {
  const { supabase } = await requirePortal();
  const { data: cs } = await supabase.from("company_settings").select("disabled_modules").maybeSingle();
  if ((cs?.disabled_modules ?? []).includes("subscriptions")) notFound(); // Setup → Modules
  const [{ data: subs }, { data: invoices }] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("id, name, description, status, quantity, unit_price, tax_rate, currency, interval_count, interval_unit, start_date, next_billing_date, cycles_billed, auto_charge, cancel_at_period_end, cancelled_at")
      .order("status")
      .order("name"),
    supabase.from("sales_docs").select("id, number, date, subscription_id").not("subscription_id", "is", null).neq("status", "draft").order("date", { ascending: false }),
  ]);
  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Subscriptions</h1>
        <p className="text-sm text-slate-500">Your plans with us. Each period&apos;s invoice appears under <Link href="/portal/invoices" className="font-medium text-brand-700 hover:underline">Invoices</Link>.</p>
      </div>
      {!subs?.length ? (
        <Card><EmptyState icon={Repeat} title="No subscriptions" description="Plans you subscribe to will appear here." /></Card>
      ) : (
        <div className="space-y-4">
          {subs.map((s) => {
            const st = SUB_STATUS[s.status] ?? SUB_STATUS.active!;
            const live = s.status === "active" || s.status === "paused";
            const theirs = (invoices ?? []).filter((i) => i.subscription_id === s.id);
            return (
              <Card key={s.id}>
                <CardBody className="space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-900">{s.name}</span>
                        <Badge className={st.color}>{st.label}</Badge>
                        {live && s.cancel_at_period_end && <Badge className="bg-amber-50 text-amber-700 ring-amber-200">Ends {s.next_billing_date ? formatDate(s.next_billing_date) : "soon"}</Badge>}
                      </div>
                      {s.description && <p className="mt-0.5 text-sm text-slate-500">{s.description}</p>}
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-slate-900">{formatMoney(withTax(s), s.currency)}</div>
                      <div className="text-xs text-slate-500">every {INTERVAL_LABEL(s.interval_count, s.interval_unit)}, incl. GST</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-500">
                    <span>Started {formatDate(s.start_date)}</span>
                    {s.status === "active" && s.next_billing_date && !s.cancel_at_period_end && <span>Next invoice {formatDate(s.next_billing_date)}</span>}
                    {s.cancelled_at && <span>Ended {formatDate(s.cancelled_at)}</span>}
                    {s.auto_charge && <span className="inline-flex items-center gap-1"><CreditCard className="h-3.5 w-3.5" /> Charged automatically</span>}
                    {theirs.length > 0 && <span>{theirs.length} invoice{theirs.length === 1 ? "" : "s"} · latest <Link href={`/portal/invoices/${theirs[0]!.id}`} className="font-medium text-brand-700 hover:underline">{formatDate(theirs[0]!.date)}</Link></span>}
                  </div>
                  {live && (
                    <div className="border-t border-slate-100 pt-3">
                      {s.cancel_at_period_end ? (
                        <form action={portalSubscriptionEnd} className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
                          <span>This plan ends on {s.next_billing_date ? formatDate(s.next_billing_date) : "its next billing date"} — no further invoice.</span>
                          <input type="hidden" name="id" value={s.id} />
                          <input type="hidden" name="undo" value="1" />
                          <SubmitButton size="sm" variant="secondary" pendingText="…"><Undo2 className="h-3.5 w-3.5" /> Keep my subscription</SubmitButton>
                        </form>
                      ) : (
                        <ConfirmForm
                          action={portalSubscriptionEnd}
                          message={s.cycles_billed > 0 ? `End “${s.name}” on ${s.next_billing_date ? formatDate(s.next_billing_date) : "its next billing date"}? You won't be billed again.` : `Cancel “${s.name}”? It hasn't started yet, so it ends now.`}
                          className="flex justify-end"
                        >
                          <input type="hidden" name="id" value={s.id} />
                          <button className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700">
                            <CalendarX className="h-3.5 w-3.5" /> {s.cycles_billed > 0 ? "Cancel at end of period" : "Cancel"}
                          </button>
                        </ConfirmForm>
                      )}
                    </div>
                  )}
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
