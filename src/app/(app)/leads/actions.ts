"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logActivity } from "@/lib/activity";
import { assertAccess, denied, requireStaff } from "@/lib/auth";
import { num, str } from "@/lib/utils";
import { discardUpload, fileRow } from "@/lib/uploads";
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
    state: str(form, "state"),
    zip: str(form, "zip"),
    country: str(form, "country"),
    value: num(form, "value"),
    description: str(form, "description"),
    status_id: num(form, "status_id"),
    source_id: num(form, "source_id"),
    assigned_to: str(form, "assigned_to"),
    // Perfex "Contacted today": stamps the last contact time
    ...(form.get("contacted_today") ? { last_contact_at: new Date().toISOString() } : {}),
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
    await removeLeads(supabase, [id]);
    revalidatePath("/leads");
    redirect("/leads");
  });
}

/** Delete leads with their tasks, notes and stored attachments (file rows go with the lead). */
async function removeLeads(supabase: Awaited<ReturnType<typeof requireStaff>>["supabase"], ids: number[]) {
  const { data: files } = await supabase.from("lead_files").select("path").in("lead_id", ids);
  must(await supabase.from("tasks").delete().eq("rel_type", "lead").in("rel_id", ids));
  must(await supabase.from("notes").delete().eq("rel_type", "lead").in("rel_id", ids));
  must(await supabase.from("leads").delete().in("id", ids));
  if (files?.length) await supabase.storage.from(LEAD_BUCKET).remove(files.map((f) => f.path));
}

/** Perfex "Contacted today" on the lead record. */
export async function markContacted(form: FormData) {
  return withFlash(async () => {
    const { supabase } = await assertAccess("leads", "edit");
    const id = Number(str(form, "id"));
    must(await supabase.from("leads").update({ last_contact_at: new Date().toISOString() }).eq("id", id));
    await logActivity(supabase, "logged contact with the lead today", { type: "lead", id });
    revalidatePath(`/leads/${id}`);
    revalidatePath("/leads");
  });
}

// ───────────── Bulk actions (list view) ─────────────
export async function bulkLeads(form: FormData) {
  return withFlash(async () => {
    const op = str(form, "op") ?? "";
    const ids = [...new Set(form.getAll("ids").map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, 500);
    if (!ids.length) throw new Error("Tick at least one lead first.");
    const { supabase } = await assertAccess("leads", op === "delete" ? "full" : "edit");
    const target = str(form, "target");
    const n = `${ids.length} lead${ids.length === 1 ? "" : "s"}`;
    switch (op) {
      case "status":
        if (!Number(target)) throw new Error("Pick a status.");
        must(await supabase.from("leads").update({ status_id: Number(target) }).in("id", ids));
        break;
      case "source":
        if (!Number(target)) throw new Error("Pick a source.");
        must(await supabase.from("leads").update({ source_id: Number(target) }).in("id", ids));
        break;
      case "assign":
        must(await supabase.from("leads").update({ assigned_to: target && target !== "none" ? target : null }).in("id", ids));
        break;
      case "tag":
        if (!Number(target)) throw new Error("Pick a tag.");
        must(await supabase.from("taggables").upsert(ids.map((id) => ({ tag_id: Number(target), rel_type: "lead", rel_id: id })), { ignoreDuplicates: true }));
        break;
      case "lost":
      case "junk":
      case "unlost":
      case "unjunk": {
        const flag = op.endsWith("lost") ? "is_lost" : "is_junk";
        must(await supabase.from("leads").update({ [flag]: !op.startsWith("un") }).in("id", ids));
        break;
      }
      case "contacted":
        must(await supabase.from("leads").update({ last_contact_at: new Date().toISOString() }).in("id", ids));
        break;
      case "delete":
        await removeLeads(supabase, ids);
        await logActivity(supabase, `deleted ${n}`);
        revalidatePath("/leads");
        return;
      default:
        throw new Error("Pick an action.");
    }
    await logActivity(supabase, `bulk-updated ${n} (${op})`);
    revalidatePath("/leads");
    revalidatePath("/dashboard");
  });
}

// ───────────── Attachments (uploaded from the browser straight to storage) ─────────────
const LEAD_BUCKET = "lead-files";

export async function recordLeadFile(input: { rel_id: number; name: string; path: string; size: number; mime: string | null }): Promise<{ error?: string }> {
  const { supabase, can, roleName } = await requireStaff();
  if (!can("leads", "edit")) return denied(roleName, "leads", "edit");
  const row = fileRow(input);
  const leadId = Number(input.rel_id);
  if (!row || !row.path.startsWith(`${leadId}/`)) return { error: "Invalid file." };
  const { error } = await supabase.from("lead_files").insert({ lead_id: leadId, ...row });
  if (error) {
    await discardUpload(supabase, LEAD_BUCKET, "lead_files", row.path);
    return { error: friendlyError(error.message) };
  }
  await logActivity(supabase, `attached ${row.name}`, { type: "lead", id: leadId });
  revalidatePath(`/leads/${leadId}`);
  return {};
}

export async function deleteLeadFile(form: FormData) {
  return withFlash(async () => {
    const { supabase } = await assertAccess("leads", "edit");
    const { data } = await supabase.from("lead_files").delete().eq("id", Number(str(form, "id"))).select("path, lead_id").maybeSingle();
    if (!data) throw new Error("Only the uploader, or someone with full lead access, can delete this file.");
    await supabase.storage.from(LEAD_BUCKET).remove([data.path]);
    revalidatePath(`/leads/${data.lead_id}`);
  });
}
