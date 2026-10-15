import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export async function logActivity(
  supabase: SupabaseClient<Database>,
  description: string,
  rel?: { type: "customer" | "lead" | "task" | "project" | "ticket" | "contract"; id: number },
) {
  await supabase.from("activity_log").insert({ description, rel_type: rel?.type ?? null, rel_id: rel?.id ?? null });
}
