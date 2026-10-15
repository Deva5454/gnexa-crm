import Link from "next/link";
import { FileBarChart, Plus } from "lucide-react";
import { SUB_STATUS, withTax } from "@/app/(app)/subscriptions/status";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { requireStaff } from "@/lib/auth";
import { INTERVAL_LABEL } from "@/lib/sales";
import { formatDate, formatMoney } from "@/lib/utils";

/** Subscriptions + statement shortcut for a customer's Billing tab. */
export async function CustomerSubscriptions({ customerId }: { customerId: number }) {
  const { supabase, can } = await requireStaff();
  if (!can("sales", "view")) return null;
  const { data: subs } = await supabase
    .from("subscriptions")
    .select("id, name, status, quantity, unit_price, tax_rate, currency, interval_count, interval_unit, next_billing_date")
    .eq("customer_id", customerId)
    .order("status")
    .order("created_at", { ascending: false });
  return (
    <Card>
      <CardHeader
        title="Subscriptions"
        action={
          <div className="flex gap-2">
            <LinkButton href={`/customers/${customerId}/statement`} size="sm" variant="secondary"><FileBarChart className="h-3.5 w-3.5" /> Statement</LinkButton>
            {can("sales", "edit") && <LinkButton href={`/subscriptions/new?customer=${customerId}`} size="sm" variant="secondary"><Plus className="h-3.5 w-3.5" /> Subscription</LinkButton>}
          </div>
        }
      />
      {!subs?.length ? (
        <p className="px-5 py-4 text-sm text-slate-400">No subscriptions.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {subs.map((s) => {
            const st = SUB_STATUS[s.status] ?? SUB_STATUS.active!;
            return (
              <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-sm">
                <Link href={`/subscriptions/${s.id}`} className="min-w-0 flex-1 font-medium text-slate-900 hover:text-brand-700">{s.name}</Link>
                <span className="text-slate-500">{formatMoney(withTax(s), s.currency)} / {INTERVAL_LABEL(s.interval_count, s.interval_unit)}</span>
                <span className="w-28 text-xs text-slate-400">{s.status === "active" && s.next_billing_date ? `next ${formatDate(s.next_billing_date)}` : ""}</span>
                <Badge className={st.color}>{st.label}</Badge>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
