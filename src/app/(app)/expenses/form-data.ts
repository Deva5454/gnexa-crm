import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { allRows } from "@/lib/fetch-all";

export async function expenseOptions(supabase: SupabaseClient<Database>) {
  const [{ data: categories }, { data: customers }, { data: modes }, { data: taxes }, { data: projects }] = await Promise.all([
    supabase.from("expense_categories").select("id, name").order("name"),
    allRows((a, b) => supabase.from("customers").select("id, company").order("company").order("id").range(a, b)),
    supabase.from("payment_modes").select("id, name").eq("is_active", true).order("id"),
    supabase.from("taxes").select("rate").order("rate"),
    supabase.from("projects").select("id, name, customer_id").not("status", "in", "(cancelled)").order("name"),
  ]);
  return {
    categories: categories ?? [],
    customers: (customers ?? []).map((c) => ({ id: c.id, name: c.company })),
    modes: modes ?? [],
    taxRates: (taxes ?? []).map((t) => Number(t.rate)),
    projects: projects ?? [],
  };
}
