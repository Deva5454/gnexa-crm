"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, requireStaff } from "@/lib/auth";
import { CF_ENTITIES, CF_TYPES, type CfEntity } from "@/lib/custom-fields";
import { str } from "@/lib/utils";
import { friendlyError, must, withFlash } from "@/lib/flash";

export type CfState = { error?: string; ok?: string } | undefined;

const MODULE: Record<CfEntity, "customers" | "leads" | "projects" | "support" | "sales" | "contracts"> = {
  customer: "customers",
  lead: "leads",
  project: "projects",
  ticket: "support",
  sales_doc: "sales",
  contract: "contracts",
};

/** Save every custom field value posted as cf_<id> for one record. */
export async function saveCustomFieldValues(entity: CfEntity, relId: number, path: string, _: CfState, form: FormData): Promise<CfState> {
  const { supabase, can } = await requireStaff();
  if (!can(MODULE[entity], "edit")) return { error: "Your role can't edit this record." };
  const { data: fields } = await supabase.from("custom_fields").select("id, label, type, options, required").eq("entity", entity).eq("is_active", true);
  const upserts: { field_id: number; rel_id: number; value: string }[] = [];
  const clears: number[] = [];
  for (const f of fields ?? []) {
    let v = f.type === "checkbox" ? (form.get(`cf_${f.id}`) === "on" ? "true" : "false") : (str(form, `cf_${f.id}`) ?? "");
    v = v.slice(0, 2000);
    if (f.required && (!v || (f.type === "checkbox" && v === "false"))) return { error: `“${f.label}” is required.` };
    if (v && f.type === "number" && !Number.isFinite(Number(v))) return { error: `“${f.label}” must be a number.` };
    if (v && f.type === "select" && !f.options.includes(v)) return { error: `Pick one of the options for “${f.label}”.` };
    if (v) upserts.push({ field_id: f.id, rel_id: relId, value: v });
    else clears.push(f.id);
  }
  if (upserts.length) {
    const { error } = await supabase.from("custom_field_values").upsert(upserts);
    if (error) return { error: friendlyError(error.message) };
  }
  if (clears.length) await supabase.from("custom_field_values").delete().eq("rel_id", relId).in("field_id", clears);
  revalidatePath(path);
  return { ok: "Saved." };
}

// ── Setup → Custom fields ──
export async function saveCustomField(form: FormData) {
  return withFlash(async () => {
    const { supabase } = await requireAdmin();
    const id = Number(str(form, "id"));
    const entity = str(form, "entity");
    const type = str(form, "type");
    const label = str(form, "label");
    if (!label) return;
    const options = (str(form, "options") ?? "").split(/[\n,]/).map((o) => o.trim()).filter(Boolean).slice(0, 50);
    const patch = {
      label: label.slice(0, 60),
      options: type === "select" ? options : [],
      required: form.get("required") === "on",
      show_on_pdf: form.get("show_on_pdf") === "on",
      is_active: id ? form.get("is_active") === "on" : true,
    };
    if (id) must(await supabase.from("custom_fields").update(patch).eq("id", id));
    else {
      if (!CF_ENTITIES.some((e) => e.key === entity) || !CF_TYPES.some((t) => t.key === type)) return;
      const { count } = await supabase.from("custom_fields").select("id", { count: "exact", head: true }).eq("entity", entity!);
      must(await supabase.from("custom_fields").insert({ ...patch, entity: entity!, type: type!, position: (count ?? 0) + 1 }));
    }
    revalidatePath("/settings/custom-fields");
  });
}

export async function deleteCustomField(form: FormData) {
  return withFlash(async () => {
    const { supabase } = await requireAdmin();
    must(await supabase.from("custom_fields").delete().eq("id", Number(str(form, "id"))));
    revalidatePath("/settings/custom-fields");
  });
}
