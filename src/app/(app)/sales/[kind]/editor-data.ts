import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { CatalogueItem, PartyOption } from "./doc-editor";
import { allRows } from "@/lib/fetch-all";

export type BillableExpense = { id: number; customer_id: number; name: string; date: string; amount: number; tax_rate: number; category: string | null; invoice_id: number | null };

/** docId: when editing an invoice, also return expenses already billed on it. */
export async function editorOptions(supabase: SupabaseClient<Database>, docId?: number) {
  const { data: exps } = await supabase
    .from("expenses")
    .select("id, customer_id, name, date, amount, tax_rate, invoice_id, category:expense_categories(name)")
    .eq("is_billable", true)
    .not("customer_id", "is", null)
    .or(docId ? `invoice_id.is.null,invoice_id.eq.${docId}` : "invoice_id.is.null")
    .order("date");
  const billableExpenses: BillableExpense[] = (exps ?? []).map((e) => ({
    id: e.id, customer_id: e.customer_id!, name: e.name, date: e.date, amount: Number(e.amount), tax_rate: Number(e.tax_rate), category: e.category?.name ?? null, invoice_id: e.invoice_id,
  }));
  const [{ data: customers }, { data: leads }, { data: items }, { data: taxes }, { data: settings }, { data: currencies }, { data: staff }, { data: templates }] = await Promise.all([
    allRows((a, b) => supabase.from("customers").select("id, company, currency").order("company").order("id").range(a, b)),
    supabase.from("leads").select("id, name, company").is("converted_customer_id", null).eq("is_junk", false).eq("is_lost", false).order("name").limit(1000),
    supabase.from("items").select("id, name, description, rate, unit, hsn_sac, tax:taxes(rate)").order("name"),
    supabase.from("taxes").select("rate").order("rate"),
    supabase.from("company_settings").select("currency, default_terms").maybeSingle(),
    supabase.from("currencies").select("code").order("is_base", { ascending: false }).order("code"),
    supabase.from("profiles").select("id, full_name").eq("is_active", true).order("full_name"),
    supabase.from("proposal_templates").select("id, name, content").order("name"),
  ]);
  return {
    customers: (customers ?? []).map<PartyOption>((c) => ({ value: `customer:${c.id}`, label: c.company, currency: c.currency })),
    currencies: (currencies ?? []).map((c) => c.code),
    staff: (staff ?? []).map((p) => ({ value: p.id, label: p.full_name })),
    templates: templates ?? [],
    billableExpenses,
    leads: (leads ?? []).map<PartyOption>((l) => ({ value: `lead:${l.id}`, label: l.company ? `${l.name} · ${l.company}` : l.name })),
    catalogue: (items ?? []).map<CatalogueItem>((i) => ({ id: i.id, name: i.name, description: i.description, rate: Number(i.rate), unit: i.unit, hsn_sac: i.hsn_sac, tax_rate: Number(i.tax?.rate ?? 0) })),
    taxRates: (taxes ?? []).map((t) => Number(t.rate)),
    currency: settings?.currency ?? "INR",
    defaultTerms: settings?.default_terms ?? "",
  };
}
