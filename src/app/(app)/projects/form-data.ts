import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { allRows } from "@/lib/fetch-all";

export async function projectFormOptions(supabase: SupabaseClient<Database>) {
  const [{ data: customers }, { data: staff }] = await Promise.all([
    allRows((a, b) => supabase.from("customers").select("id, company").order("company").order("id").range(a, b)),
    supabase.from("profiles").select("id, full_name").eq("is_active", true).order("full_name"),
  ]);
  return { customers: customers ?? [], staff: staff ?? [] };
}
