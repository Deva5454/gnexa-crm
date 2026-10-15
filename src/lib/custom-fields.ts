import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export const CF_ENTITIES = [
  { key: "customer", label: "Customers" },
  { key: "lead", label: "Leads" },
  { key: "project", label: "Projects" },
  { key: "ticket", label: "Support tickets" },
  { key: "sales_doc", label: "Invoices, estimates & proposals" },
  { key: "contract", label: "Contracts" },
] as const;
export type CfEntity = (typeof CF_ENTITIES)[number]["key"];

export const CF_TYPES = [
  { key: "text", label: "Short text" },
  { key: "textarea", label: "Long text" },
  { key: "number", label: "Number" },
  { key: "date", label: "Date" },
  { key: "select", label: "Dropdown" },
  { key: "checkbox", label: "Yes / no" },
] as const;

export type CfField = { id: number; label: string; type: string; options: string[]; required: boolean; show_on_pdf: boolean };

/** Active fields for an entity, with this record's values. */
export async function loadCustomFields(supabase: SupabaseClient<Database>, entity: CfEntity, relId: number) {
  const { data: fields } = await supabase
    .from("custom_fields")
    .select("id, label, type, options, required, show_on_pdf")
    .eq("entity", entity)
    .eq("is_active", true)
    .order("position")
    .order("id");
  if (!fields?.length) return { fields: [] as CfField[], values: {} as Record<number, string> };
  const { data: vals } = await supabase.from("custom_field_values").select("field_id, value").eq("rel_id", relId).in("field_id", fields.map((f) => f.id));
  const values: Record<number, string> = {};
  for (const v of vals ?? []) if (v.value != null) values[v.field_id] = v.value;
  return { fields, values };
}

/** Fields flagged "show on PDF" with values, for printing on a sales document. */
export async function pdfFields(supabase: SupabaseClient<Database>, docId: number) {
  const { fields, values } = await loadCustomFields(supabase, "sales_doc", docId);
  return fields.filter((f) => f.show_on_pdf && values[f.id]).map((f) => ({ label: f.label, value: displayValue(f, values[f.id]!) }));
}

export function displayValue(f: { type: string }, v: string) {
  if (f.type === "checkbox") return v === "true" ? "Yes" : "No";
  if (f.type === "date" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return new Date(`${v}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  return v;
}
