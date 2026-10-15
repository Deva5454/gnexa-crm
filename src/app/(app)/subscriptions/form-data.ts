import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export async function subscriptionOptions(supabase: SupabaseClient<Database>) {
  const [{ data: customers }, { data: items }, { data: taxes }] = await Promise.all([
    supabase.from("customers").select("id, company").eq("is_active", true).order("company"),
    supabase.from("items").select("id, name, description, rate, tax:taxes(rate)").order("name"),
    supabase.from("taxes").select("rate").order("rate"),
  ]);
  return {
    customers: (customers ?? []).map((c) => ({ id: c.id, name: c.company })),
    items: (items ?? []).map((i) => ({ id: i.id, name: i.name, description: i.description, rate: Number(i.rate), tax_rate: Number(i.tax?.rate ?? 0) })),
    taxRates: [...new Set((taxes ?? []).map((t) => Number(t.rate)))],
  };
}
