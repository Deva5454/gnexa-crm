import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/lib/database.types";
import { allRows } from "@/lib/fetch-all";
import { toBase } from "@/lib/sales-data";

export const GOAL_METRICS = [
  { value: "invoiced", label: "Amount invoiced", money: true, hint: "Invoices dated in the period (excl. drafts & cancelled)" },
  { value: "collected", label: "Payments collected", money: true, hint: "Payments received in the period" },
  { value: "leads_converted", label: "Leads converted", money: false, hint: "Leads turned into customers in the period" },
  { value: "new_customers", label: "New customers", money: false, hint: "Customers added in the period" },
  { value: "tickets_closed", label: "Tickets closed", money: false, hint: "Support tickets closed in the period" },
] as const;
export const goalMetric = (v: string) => GOAL_METRICS.find((m) => m.value === v) ?? GOAL_METRICS[0];

/** Live progress for each goal; a goal with a staff member counts only their work. */
export async function goalProgress(supabase: SupabaseClient<Database>, goals: Tables<"goals">[]) {
  const out = new Map<number, number>();
  for (const g of goals) {
    const from = g.start_date;
    const to = `${g.end_date}T23:59:59.999Z`;
    let value = 0;
    if (g.metric === "invoiced") {
      const { data } = await allRows((a, b) => {
        let q = supabase.from("sales_docs").select("total, exchange_rate").eq("kind", "invoice").in("status", ["sent", "accepted"]).gte("date", from).lte("date", g.end_date);
        if (g.staff_id) q = q.eq("created_by", g.staff_id);
        return q.order("id").range(a, b);
      });
      value = data.reduce((s, r) => s + toBase(Number(r.total), r.exchange_rate), 0);
    } else if (g.metric === "collected") {
      const { data } = await allRows((a, b) => {
        let q = supabase.from("payments").select("amount, invoice:sales_docs(exchange_rate)").gte("date", from).lte("date", g.end_date);
        if (g.staff_id) q = q.eq("created_by", g.staff_id);
        return q.order("id").range(a, b);
      });
      value = data.reduce((s, r) => s + toBase(Number(r.amount), r.invoice?.exchange_rate), 0);
    } else if (g.metric === "leads_converted") {
      let q = supabase.from("leads").select("id", { count: "exact", head: true }).gte("converted_at", from).lte("converted_at", to);
      if (g.staff_id) q = q.eq("assigned_to", g.staff_id);
      value = (await q).count ?? 0;
    } else if (g.metric === "new_customers") {
      let q = supabase.from("customers").select("id", { count: "exact", head: true }).gte("created_at", from).lte("created_at", to);
      if (g.staff_id) q = q.eq("created_by", g.staff_id);
      value = (await q).count ?? 0;
    } else if (g.metric === "tickets_closed") {
      let q = supabase.from("tickets").select("id", { count: "exact", head: true }).gte("closed_at", from).lte("closed_at", to);
      if (g.staff_id) q = q.eq("assigned_to", g.staff_id);
      value = (await q).count ?? 0;
    }
    out.set(g.id, value);
  }
  return out;
}
