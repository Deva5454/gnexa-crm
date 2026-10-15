import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export async function expenseOptions(supabase: SupabaseClient<Database>) {
  const [{ data: categories }, { data: customers }, { data: modes }, { data: taxes }] = await Promise.all([
    supabase.from("expense_categories").select("id, name").order("name"),
    supabase.from("customers").select("id, company").order("company").limit(1000),
    supabase.from("payment_modes").select("id, name").eq("is_active", true).order("id"),
    supabase.from("taxes").select("rate").order("rate"),
  ]);
  return {
    categories: categories ?? [],
    customers: (customers ?? []).map((c) => ({ id: c.id, name: c.company })),
    modes: modes ?? [],
    taxRates: (taxes ?? []).map((t) => Number(t.rate)),
  };
}
