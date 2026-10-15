import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export async function contractFormOptions(supabase: SupabaseClient<Database>) {
  const [{ data: customers }, { data: types }] = await Promise.all([
    supabase.from("customers").select("id, company").order("company").limit(1000),
    supabase.from("contract_types").select("id, name").order("name"),
  ]);
  return { customers: customers ?? [], types: types ?? [] };
}
