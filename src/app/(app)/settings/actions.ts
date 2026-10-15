"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { num, str } from "@/lib/utils";

export type SettingsState = { error?: string; ok?: string } | undefined;

export async function updateCompany(_: SettingsState, form: FormData): Promise<SettingsState> {
  const { supabase } = await requireAdmin();
  const company_name = str(form, "company_name");
  const currency = str(form, "currency")?.toUpperCase();
  if (!company_name || !currency || currency.length !== 3) return { error: "Company name and a 3-letter currency code are required." };
  const { error } = await supabase
    .from("company_settings")
    .update({
      company_name,
      currency,
      address: str(form, "address"),
      gstin: str(form, "gstin")?.toUpperCase() ?? null,
      email: str(form, "email"),
      phone: str(form, "phone"),
      bank_details: str(form, "bank_details"),
      default_terms: str(form, "default_terms"),
      updated_at: new Date().toISOString(),
    })
    .eq("id", true);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: "Settings saved." };
}

export async function updateStaff(form: FormData) {
  const { supabase, profile } = await requireAdmin();
  const id = str(form, "id")!;
  const patch = {
    role_id: num(form, "role_id"),
    // An admin can't lock themselves out
    is_admin: id === profile.id ? true : form.get("is_admin") === "on",
    is_active: id === profile.id ? true : form.get("is_active") === "on",
  };
  await supabase.from("profiles").update(patch).eq("id", id);
  // Support departments the person belongs to (they get portal tickets for these)
  const depts = form.getAll("dept").map(Number).filter(Boolean);
  await supabase.from("staff_departments").delete().eq("staff_id", id);
  if (depts.length) await supabase.from("staff_departments").insert(depts.map((department_id) => ({ staff_id: id, department_id })));
  revalidatePath("/settings/staff");
}

export async function savePredefinedReply(form: FormData) {
  const { supabase } = await requireAdmin();
  const id = Number(str(form, "id"));
  const title = str(form, "title");
  const body = str(form, "body");
  if (!title || !body) return;
  if (id) await supabase.from("predefined_replies").update({ title, body }).eq("id", id);
  else await supabase.from("predefined_replies").insert({ title, body });
  revalidatePath("/settings/delivery");
}

export async function deletePredefinedReply(form: FormData) {
  const { supabase } = await requireAdmin();
  await supabase.from("predefined_replies").delete().eq("id", Number(str(form, "id")));
  revalidatePath("/settings/delivery");
}

export async function addStatus(form: FormData) {
  const { supabase } = await requireAdmin();
  const name = str(form, "name");
  if (!name) return;
  const { data: last } = await supabase.from("lead_statuses").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle();
  await supabase.from("lead_statuses").insert({ name, color: str(form, "color") ?? "#6366f1", sort_order: (last?.sort_order ?? 0) + 1, is_won: form.get("is_won") === "on" });
  revalidatePath("/settings/leads");
}

export async function updateStatus(form: FormData) {
  const { supabase } = await requireAdmin();
  const id = Number(str(form, "id"));
  const name = str(form, "name");
  if (!name) return;
  await supabase
    .from("lead_statuses")
    .update({ name, color: str(form, "color") ?? "#6366f1", sort_order: num(form, "sort_order") ?? 0, is_won: form.get("is_won") === "on" })
    .eq("id", id);
  revalidatePath("/settings/leads");
  revalidatePath("/leads");
}

const SIMPLE = ["lead_sources", "customer_groups", "roles", "lead_statuses", "payment_modes", "expense_categories", "taxes", "contract_types", "ticket_departments", "kb_groups"] as const;
type SimpleTable = (typeof SIMPLE)[number];

export async function addNamed(form: FormData) {
  const { supabase } = await requireAdmin();
  const table = str(form, "table") as SimpleTable;
  const name = str(form, "name");
  if (!SIMPLE.includes(table) || table === "lead_statuses" || table === "taxes" || !name) return;
  await supabase.from(table).insert({ name });
  revalidatePath("/settings", "layout");
}

export async function deleteNamed(form: FormData) {
  const { supabase } = await requireAdmin();
  const table = str(form, "table") as SimpleTable;
  const id = Number(str(form, "id"));
  if (!SIMPLE.includes(table)) return;
  await supabase.from(table).delete().eq("id", id);
  revalidatePath("/settings", "layout");
}

export async function resetDemoData(): Promise<SettingsState> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("reset_demo_data");
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: "Demo data restored — customers, leads, tasks and notes are back to their starting state." };
}

export async function addTax(form: FormData) {
  const { supabase } = await requireAdmin();
  const rate = num(form, "rate");
  if (rate == null || rate < 0 || rate > 100) return;
  await supabase.from("taxes").insert({ name: str(form, "name") ?? `GST ${rate}%`, rate });
  revalidatePath("/settings/finance");
}

export async function saveRolePermissions(form: FormData) {
  const { supabase } = await requireAdmin();
  const id = Number(str(form, "role_id"));
  const { MODULES } = await import("@/lib/permissions");
  const permissions: Record<string, string> = {};
  for (const m of MODULES) {
    const v = str(form, m);
    permissions[m] = v === "none" || v === "view" || v === "edit" || v === "full" ? v : "view";
  }
  await supabase.from("roles").update({ permissions }).eq("id", id);
  revalidatePath("/settings/staff");
}
