import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { RelOption } from "./task-form";

export async function taskFormOptions(supabase: SupabaseClient<Database>) {
  const [{ data: staff }, { data: customers }, { data: leads }] = await Promise.all([
    supabase.from("profiles").select("id, full_name").eq("is_active", true).order("full_name"),
    supabase.from("customers").select("id, company").eq("is_active", true).order("company").limit(500),
    supabase.from("leads").select("id, name, company").is("converted_customer_id", null).eq("is_junk", false).order("name").limit(500),
  ]);
  return {
    staff: staff ?? [],
    customers: (customers ?? []).map<RelOption>((c) => ({ value: `customer:${c.id}`, label: c.company })),
    leads: (leads ?? []).map<RelOption>((l) => ({ value: `lead:${l.id}`, label: l.company ? `${l.name} · ${l.company}` : l.name })),
  };
}
