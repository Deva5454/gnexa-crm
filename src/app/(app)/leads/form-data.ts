import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export async function leadFormOptions(supabase: SupabaseClient<Database>) {
  const [{ data: statuses }, { data: sources }, { data: staff }] = await Promise.all([
    supabase.from("lead_statuses").select("id, name").order("sort_order"),
    supabase.from("lead_sources").select("id, name").order("name"),
    supabase.from("profiles").select("id, full_name").eq("is_active", true).order("full_name"),
  ]);
  return { statuses: statuses ?? [], sources: sources ?? [], staff: staff ?? [] };
}
