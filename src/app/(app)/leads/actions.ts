"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logActivity } from "@/lib/activity";
import { assertAccess, denied, requireStaff } from "@/lib/auth";
import { num, str } from "@/lib/utils";
import { friendlyError, must, withFlash } from "@/lib/flash";

export type FormState = { error?: string } | undefined;

function leadFields(form: FormData) {
  return {
    name: str(form, "name") ?? "",
    company: str(form, "company"),
    title: str(form, "title"),
    email: str(form, "email"),
    phone: str(form, "phone"),
    website: str(form, "website"),
    address: str(form, "address"),
    city: str(form, "city"),
    country: str(form, "country"),
    value: num(form, "value"),
    description: str(form, "description"),
    status_id: num(form, "status_id"),
    source_id: num(form, "source_id"),
    assigned_to: str(form, "assigned_to"),
  };
}

export async function createLead(_: FormState, form: FormData): Promise<FormState> {
  const { supabase, can, roleName } = await requireStaff();
  if (!can("leads", "edit")) return denied(roleName, "leads", "edit");
  const fields = leadFields(form);
  if (!fields.name) return { error: "Lead name is required." };
  const { data, error } = await supabase
    .from("leads")
    .insert({ ...fields, position: Date.now() / 1000 })
    .select("id")
    .single();
  if (error) return { error: friendlyError(error.message) };
  await logActivity(supabase, `created lead "${fields.name}"`, { type: "lead", id: data.id });
  revalidatePath("/leads");
  redirect(`/leads/${data.id}`);
}

export async function updateLead(id: number, _: FormState, form: FormData): Promise<FormState> {
  const { supabase, can, roleName } = await requireStaff();
  if (!can("leads", "edit")) return denied(roleName, "leads", "edit");
  const fields = leadFields(form);
  if (!fields.name) return { error: "Lead name is required." };
  const { error } = await supabase.from("leads").update(fields).eq("id", id);
  if (error) return { error: friendlyError(error.message) };
  await logActivity(supabase, `updated lead "${fields.name}"`, { type: "lead", id });
  revalidatePath(`/leads/${id}`);
  redirect(`/leads/${id}`);
}

/** Kanban drop: new status and a fractional position between neighbours. */
export async function moveLead(id: number, statusId: number, position: number): Promise<{ error?: string }> {
  const { supabase, can, roleName } = await requireStaff();
  if (!can("leads", "edit")) return denied(roleName, "leads", "edit");
  const { data: before } = await supabase.from("leads").select("name, status_id").eq("id", id).single();
  const { error } = await supabase.from("leads").update({ status_id: statusId, position }).eq("id", id);
  if (error) return { error: friendlyError(error.message) };
  if (before && before.status_id !== statusId) {
    const { data: s } = await supabase.from("lead_statuses").select("name").eq("id", statusId).single();
    await logActivity(supabase, `moved lead "${before.name}" to ${s?.name ?? "a new stage"}`, { type: "lead", id });
  }
  revalidatePath("/leads");
  revalidatePath("/dashboard");
  return {};
}

export async function setLeadFlag(form: FormData) {
  return withFlash(async () => {
    const { supabase } = await assertAccess("leads", "edit");
    const id = Number(str(form, "id"));
    const flag = str(form, "flag");
    const value = str(form, "value") === "1";
    if (flag !== "is_lost" && flag !== "is_junk") return;
    must(await supabase.from("leads").update({ [flag]: value }).eq("id", id));
    const label = flag === "is_lost" ? "lost" : "junk";
    await logActivity(supabase, value ? `marked lead as ${label}` : `unmarked lead as ${label}`, { type: "lead", id });
    revalidatePath(`/leads/${id}`);
    revalidatePath("/leads");
  });
}

export async function convertLead(form: FormData) {
  return withFlash(async () => {
    await assertAccess("customers", "edit");
    const { supabase } = await assertAccess("leads", "edit");
    const id = Number(str(form, "id"));
    const { data: customerId, error } = await supabase.rpc("convert_lead", { p_lead_id: id });
    if (error) throw new Error(error.message);
    must(await supabase.from("tasks").update({ rel_type: "customer", rel_id: customerId }).eq("rel_type", "lead").eq("rel_id", id));
    revalidatePath("/leads");
    revalidatePath("/customers");
    redirect(`/customers/${customerId}`);
  });
}

export async function deleteLead(form: FormData) {
  return withFlash(async () => {
    const { supabase } = await assertAccess("leads", "full");
    const id = Number(str(form, "id"));
    must(await supabase.from("tasks").delete().eq("rel_type", "lead").eq("rel_id", id));
    must(await supabase.from("notes").delete().eq("rel_type", "lead").eq("rel_id", id));
    must(await supabase.from("leads").delete().eq("id", id));
    revalidatePath("/leads");
    redirect("/leads");
  });
}
