import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { RelOption } from "./task-form";
import { allRows } from "@/lib/fetch-all";

export async function taskFormOptions(supabase: SupabaseClient<Database>) {
  const [{ data: staff }, { data: customers }, { data: leads }, { data: projects }, { data: milestones }] = await Promise.all([
    supabase.from("profiles").select("id, full_name").eq("is_active", true).order("full_name"),
    allRows((a, b) => supabase.from("customers").select("id, company").eq("is_active", true).order("company").order("id").range(a, b)),
    supabase.from("leads").select("id, name, company").is("converted_customer_id", null).eq("is_junk", false).order("name").limit(500),
    supabase.from("projects").select("id, name").not("status", "in", "(cancelled,finished)").order("name").limit(500),
    supabase.from("milestones").select("id, name, project_id").order("position"),
  ]);
  return {
    staff: staff ?? [],
    customers: (customers ?? []).map<RelOption>((c) => ({ value: `customer:${c.id}`, label: c.company })),
    leads: (leads ?? []).map<RelOption>((l) => ({ value: `lead:${l.id}`, label: l.company ? `${l.name} · ${l.company}` : l.name })),
    projects: (projects ?? []).map<RelOption>((p) => ({ value: `project:${p.id}`, label: p.name })),
    milestones: (milestones ?? []).map((m) => ({ id: m.id, name: m.name, project: `project:${m.project_id}` })),
  };
}
