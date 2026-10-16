import { cache } from "react";
import { requireStaff } from "@/lib/auth";
import { allRows } from "@/lib/fetch-all";
import { docStatus, STATUS_FILTERS, type DocKind } from "@/lib/sales";
import { balancesFor, baseCurrency, toBase } from "@/lib/sales-data";
import { todayIST } from "@/lib/dates";

type Overview = { total: number; counts: Record<string, number> };

/**
 * Invoices, estimates and proposals by status, plus the money totals — read once per request and shared by
 * the Quick stats and Finance overview widgets. Null for roles without sales access.
 */
export const salesOverview = cache(async () => {
  const { supabase, can } = await requireStaff();
  if (!can("sales", "view")) return null;
  const today = todayIST();
  const { data: docs } = await allRows((a, b) =>
    supabase.from("sales_docs").select("id, kind, status, due_date, total, exchange_rate").in("kind", ["invoice", "estimate", "proposal"]).order("id").range(a, b),
  );
  const bals = await balancesFor(supabase, docs.filter((d) => d.kind === "invoice" && d.status !== "draft" && d.status !== "cancelled").map((d) => d.id));

  const kinds: DocKind[] = ["invoice", "estimate", "proposal"];
  const overview = Object.fromEntries(
    kinds.map((k) => [k, { total: 0, counts: Object.fromEntries(STATUS_FILTERS[k].map((f) => [f.key, 0])) }]),
  ) as Record<"invoice" | "estimate" | "proposal", Overview>;
  let outstanding = 0;
  let pastDue = 0;
  let paid = 0;
  for (const d of docs) {
    const kind = d.kind as "invoice" | "estimate" | "proposal";
    const b = bals.get(d.id);
    const st = docStatus({ kind, status: d.status, due_date: d.due_date, total: Number(d.total) }, b, today);
    const o = overview[kind];
    o.total++;
    o.counts[st.key] = (o.counts[st.key] ?? 0) + 1;
    if (kind !== "invoice" || st.key === "draft" || st.key === "cancelled") continue;
    const left = toBase(Math.max(0, b?.balance ?? Number(d.total)), d.exchange_rate);
    outstanding += left;
    if (st.key === "overdue") pastDue += left;
    paid += toBase(b?.paid ?? 0, d.exchange_rate);
  }
  const inv = overview.invoice.counts;
  return {
    overview,
    awaiting: (inv.unpaid ?? 0) + (inv.partial ?? 0) + (inv.overdue ?? 0),
    billable: overview.invoice.total - (inv.draft ?? 0) - (inv.cancelled ?? 0),
    outstanding,
    pastDue,
    paid,
    currency: await baseCurrency(supabase),
  };
});

/** All leads (light columns) with statuses and sources — shared by the two leads widgets. */
export const leadsData = cache(async () => {
  const { supabase, can } = await requireStaff();
  if (!can("leads", "view")) return null;
  const [{ data: leads }, { data: statuses }, { data: sources }] = await Promise.all([
    allRows((a, b) => supabase.from("leads").select("id, status_id, source_id, value, is_lost, is_junk, converted_customer_id, created_at").order("id").range(a, b)),
    supabase.from("lead_statuses").select("id, name, color").order("sort_order"),
    supabase.from("lead_sources").select("id, name"),
  ]);
  return { leads, statuses: statuses ?? [], sources: sources ?? [] };
});
