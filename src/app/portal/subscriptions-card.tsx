import { CreditCard, Repeat } from "lucide-react";
import { SUB_STATUS, withTax } from "@/app/(app)/subscriptions/status";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { requirePortal } from "@/lib/auth";
import { INTERVAL_LABEL } from "@/lib/sales";
import { formatDate, formatMoney } from "@/lib/utils";

/** The client's subscriptions (RLS limits this to their own). */
export async function PortalSubscriptions() {
  const { supabase } = await requirePortal();
  const { data: subs } = await supabase
    .from("subscriptions")
    .select("id, name, description, status, quantity, unit_price, tax_rate, currency, interval_count, interval_unit, next_billing_date, auto_charge")
    .in("status", ["active", "paused"])
    .order("name");
  if (!subs?.length) return null;
  return (
    <Card className="mt-6">
      <CardHeader title="Your subscriptions" description="Billed automatically — each period's invoice appears above." />
      <ul className="divide-y divide-slate-100">
        {subs.map((s) => {
          const st = SUB_STATUS[s.status] ?? SUB_STATUS.active!;
          return (
            <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-sm">
              <Repeat className="h-4 w-4 text-brand-500" />
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-slate-900">{s.name}</span>
                {s.description && <span className="block text-xs text-slate-500">{s.description}</span>}
              </span>
              <span className="text-slate-600">{formatMoney(withTax(s), s.currency)} / {INTERVAL_LABEL(s.interval_count, s.interval_unit)}</span>
              <span className="flex items-center gap-1 text-xs text-slate-400">
                {s.auto_charge && <CreditCard className="h-3.5 w-3.5" />}
                {s.status === "active" && s.next_billing_date ? `Next ${formatDate(s.next_billing_date)}` : ""}
              </span>
              <Badge className={st.color}>{st.label}</Badge>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
