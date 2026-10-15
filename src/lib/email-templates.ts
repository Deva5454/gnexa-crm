import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export const fill = (t: string, vars: Record<string, string>) => t.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? vars[k]! : m));

/** Subject and body of a template with its placeholders filled in. */
export async function renderTemplate(supabase: SupabaseClient<Database>, key: string, vars: Record<string, string>) {
  const { data: t } = await supabase.from("email_templates").select("subject, body").eq("key", key).maybeSingle();
  if (!t) return null;
  return { subject: fill(t.subject, vars), body: fill(t.body, vars) };
}
