import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { allRows } from "@/lib/fetch-all";

export async function contractFormOptions(supabase: SupabaseClient<Database>) {
  const [{ data: customers }, { data: types }] = await Promise.all([
    allRows((a, b) => supabase.from("customers").select("id, company").order("company").order("id").range(a, b)),
    supabase.from("contract_types").select("id, name").order("name"),
  ]);
  return { customers: customers ?? [], types: types ?? [] };
}
