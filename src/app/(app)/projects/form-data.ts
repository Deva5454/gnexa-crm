import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export async function projectFormOptions(supabase: SupabaseClient<Database>) {
  const [{ data: customers }, { data: staff }] = await Promise.all([
    supabase.from("customers").select("id, company").order("company").limit(1000),
    supabase.from("profiles").select("id, full_name").eq("is_active", true).order("full_name"),
  ]);
  return { customers: customers ?? [], staff: staff ?? [] };
}
