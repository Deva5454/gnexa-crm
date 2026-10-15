import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { CatalogueItem, PartyOption } from "./doc-editor";

export async function editorOptions(supabase: SupabaseClient<Database>) {
  const [{ data: customers }, { data: leads }, { data: items }, { data: taxes }, { data: settings }] = await Promise.all([
    supabase.from("customers").select("id, company").order("company").limit(1000),
    supabase.from("leads").select("id, name, company").is("converted_customer_id", null).eq("is_junk", false).eq("is_lost", false).order("name").limit(1000),
    supabase.from("items").select("id, name, description, rate, unit, tax:taxes(rate)").order("name"),
    supabase.from("taxes").select("rate").order("rate"),
    supabase.from("company_settings").select("currency, default_terms").maybeSingle(),
  ]);
  return {
    customers: (customers ?? []).map<PartyOption>((c) => ({ value: `customer:${c.id}`, label: c.company })),
    leads: (leads ?? []).map<PartyOption>((l) => ({ value: `lead:${l.id}`, label: l.company ? `${l.name} · ${l.company}` : l.name })),
    catalogue: (items ?? []).map<CatalogueItem>((i) => ({ id: i.id, name: i.name, description: i.description, rate: Number(i.rate), unit: i.unit, tax_rate: Number(i.tax?.rate ?? 0) })),
    taxRates: (taxes ?? []).map((t) => Number(t.rate)),
    currency: settings?.currency ?? "INR",
    defaultTerms: settings?.default_terms ?? "",
  };
}
