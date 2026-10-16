"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logActivity } from "@/lib/activity";
import { assertAccess, denied, requireStaff } from "@/lib/auth";
import { num, str } from "@/lib/utils";
import { discardUpload, fileRow } from "@/lib/uploads";
import { friendlyError, must, withFlash } from "@/lib/flash";

export type FormState = { error?: string } | undefined;

function customerFields(form: FormData) {
  return {
    company: str(form, "company") ?? "",
    vat: str(form, "vat"),
    phone: str(form, "phone"),
    website: str(form, "website"),
    address: str(form, "address"),
    city: str(form, "city"),
    state: str(form, "state"),
    zip: str(form, "zip"),
    country: str(form, "country"),
    shipping_address: str(form, "shipping_address"),
    shipping_city: str(form, "shipping_city"),
    shipping_state: str(form, "shipping_state"),
    shipping_zip: str(form, "shipping_zip"),
    shipping_country: str(form, "shipping_country"),
    currency: str(form, "currency"),
    group_id: num(form, "group_id"),
  };
}

export async function createCustomer(_: FormState, form: FormData): Promise<FormState> {
  const { supabase, can, roleName } = await requireStaff();
  if (!can("customers", "edit")) return denied(roleName, "customers", "edit");
  const fields = customerFields(form);
  if (!fields.company) return { error: "Company name is required." };

  const { data, error } = await supabase.from("customers").insert(fields).select("id").single();
  if (error) return { error: friendlyError(error.message) };

  const first = str(form, "contact_first_name");
  if (first) {
    await supabase.from("contacts").insert({
      customer_id: data.id,
      first_name: first,
      last_name: str(form, "contact_last_name"),
      email: str(form, "contact_email"),
      phone: str(form, "contact_phone"),
      title: str(form, "contact_title"),
      is_primary: true,
    });
  }
  await logActivity(supabase, `created customer "${fields.company}"`, { type: "customer", id: data.id });
  revalidatePath("/customers");
  redirect(`/customers/${data.id}`);
}

export async function updateCustomer(id: number, _: FormState, form: FormData): Promise<FormState> {
  const { supabase, can, roleName } = await requireStaff();
  if (!can("customers", "edit")) return denied(roleName, "customers", "edit");
  const fields = customerFields(form);
  if (!fields.company) return { error: "Company name is required." };
  const { error } = await supabase.from("customers").update(fields).eq("id", id);
  if (error) return { error: friendlyError(error.message) };
  await logActivity(supabase, `updated customer "${fields.company}"`, { type: "customer", id });
  revalidatePath(`/customers/${id}`);
  redirect(`/customers/${id}`);
}

export async function toggleCustomerActive(form: FormData) {
  return withFlash(async () => {
    const { supabase } = await assertAccess("customers", "edit");
    const id = Number(str(form, "id"));
    const active = str(form, "active") === "1";
    must(await supabase.from("customers").update({ is_active: active }).eq("id", id));
    await logActivity(supabase, `marked customer ${active ? "active" : "inactive"}`, { type: "customer", id });
    revalidatePath(`/customers/${id}`);
    revalidatePath("/customers");
  });
}

export async function deleteCustomer(form: FormData) {
  return withFlash(async () => {
    const { supabase } = await assertAccess("customers", "full");
    const id = Number(str(form, "id"));
    const { kept } = await removeCustomers(supabase, [id]);
    if (kept.length) throw new Error("This customer has invoices or other sales documents, projects or contracts. Mark them inactive instead of deleting.");
    revalidatePath("/customers");
    redirect("/customers");
  });
}

/**
 * Delete customers that have no sales documents, projects or contracts (those are kept — mark them inactive
 * instead), with their tasks, notes and stored files. Returns which ids were kept.
 */
async function removeCustomers(supabase: Awaited<ReturnType<typeof requireStaff>>["supabase"], ids: number[]) {
  const [{ data: docs }, { data: projects }, { data: contracts }] = await Promise.all([
    supabase.from("sales_docs").select("customer_id").in("customer_id", ids),
    supabase.from("projects").select("customer_id").in("customer_id", ids),
    supabase.from("contracts").select("customer_id").in("customer_id", ids),
  ]);
  const busy = new Set([...(docs ?? []), ...(projects ?? []), ...(contracts ?? [])].map((r) => r.customer_id));
  const kept = ids.filter((i) => busy.has(i));
  const go = ids.filter((i) => !busy.has(i));
  if (go.length) {
    const { data: files } = await supabase.from("customer_files").select("path").in("customer_id", go);
    must(await supabase.from("tasks").delete().eq("rel_type", "customer").in("rel_id", go));
    must(await supabase.from("notes").delete().eq("rel_type", "customer").in("rel_id", go));
    must(await supabase.from("customers").delete().in("id", go));
    if (files?.length) await supabase.storage.from(CUSTOMER_BUCKET).remove(files.map((f) => f.path));
  }
  return { deleted: go, kept };
}

// ───────────── Bulk actions (list) ─────────────
export async function bulkCustomers(form: FormData) {
  return withFlash(async () => {
    const op = str(form, "op") ?? "";
    const ids = [...new Set(form.getAll("ids").map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, 500);
    if (!ids.length) throw new Error("Tick at least one customer first.");
    const { supabase } = await assertAccess("customers", op === "delete" ? "full" : "edit");
    const target = str(form, "target");
    const n = `${ids.length} customer${ids.length === 1 ? "" : "s"}`;
    switch (op) {
      case "group":
        must(await supabase.from("customers").update({ group_id: target && target !== "none" ? Number(target) : null }).in("id", ids));
        break;
      case "active":
      case "inactive":
        must(await supabase.from("customers").update({ is_active: op === "active" }).in("id", ids));
        break;
      case "admin":
        if (!target) throw new Error("Pick a staff member.");
        must(await supabase.from("customer_admins").upsert(ids.map((id) => ({ customer_id: id, staff_id: target })), { ignoreDuplicates: true }));
        break;
      case "tag":
        if (!Number(target)) throw new Error("Pick a tag.");
        must(await supabase.from("taggables").upsert(ids.map((id) => ({ tag_id: Number(target), rel_type: "customer", rel_id: id })), { ignoreDuplicates: true }));
        break;
      case "delete": {
        const { deleted, kept } = await removeCustomers(supabase, ids);
        if (deleted.length) await logActivity(supabase, `deleted ${deleted.length} customer${deleted.length === 1 ? "" : "s"}`);
        revalidatePath("/customers");
        if (kept.length) throw new Error(`${deleted.length} deleted. ${kept.length} kept because they have invoices, projects or contracts — mark those inactive instead.`);
        return;
      }
      default:
        throw new Error("Pick an action.");
    }
    await logActivity(supabase, `bulk-updated ${n} (${op})`);
    revalidatePath("/customers");
  });
}

// ───────────── Customer admins ─────────────
export async function addCustomerAdmin(form: FormData) {
  return withFlash(async () => {
    const { supabase } = await assertAccess("customers", "edit");
    const id = Number(str(form, "customer_id"));
    const staff = str(form, "staff_id");
    if (!staff) throw new Error("Pick a staff member.");
    must(await supabase.from("customer_admins").upsert({ customer_id: id, staff_id: staff }, { ignoreDuplicates: true }));
    await logActivity(supabase, "assigned a customer admin", { type: "customer", id });
    revalidatePath(`/customers/${id}`);
  });
}

export async function removeCustomerAdmin(form: FormData) {
  return withFlash(async () => {
    const { supabase } = await assertAccess("customers", "edit");
    const id = Number(str(form, "customer_id"));
    must(await supabase.from("customer_admins").delete().eq("customer_id", id).eq("staff_id", str(form, "staff_id") ?? ""));
    revalidatePath(`/customers/${id}`);
  });
}

// ───────────── Files (uploaded from the browser straight to storage) ─────────────
const CUSTOMER_BUCKET = "customer-files";

export async function recordCustomerFile(input: { rel_id: number; name: string; path: string; size: number; mime: string | null }): Promise<{ error?: string }> {
  const { supabase, can, roleName } = await requireStaff();
  if (!can("customers", "edit")) return denied(roleName, "customers", "edit");
  const row = fileRow(input);
  const customerId = Number(input.rel_id);
  if (!row || !row.path.startsWith(`${customerId}/`)) return { error: "Invalid file." };
  const { error } = await supabase.from("customer_files").insert({ customer_id: customerId, ...row });
  if (error) {
    await discardUpload(supabase, CUSTOMER_BUCKET, "customer_files", row.path);
    return { error: friendlyError(error.message) };
  }
  await logActivity(supabase, `attached ${row.name}`, { type: "customer", id: customerId });
  revalidatePath(`/customers/${customerId}`);
  return {};
}

export async function deleteCustomerFile(form: FormData) {
  return withFlash(async () => {
    const { supabase } = await assertAccess("customers", "edit");
    const { data } = await supabase.from("customer_files").delete().eq("id", Number(str(form, "id"))).select("path, customer_id").maybeSingle();
    if (!data) throw new Error("Only the uploader, or someone with full customer access, can delete this file.");
    await supabase.storage.from(CUSTOMER_BUCKET).remove([data.path]);
    revalidatePath(`/customers/${data.customer_id}`);
  });
}

export async function addContact(_: FormState, form: FormData): Promise<FormState> {
  const { supabase, can, roleName } = await requireStaff();
  if (!can("customers", "edit")) return denied(roleName, "customers", "edit");
  const customerId = Number(str(form, "customer_id"));
  const first = str(form, "first_name");
  if (!first) return { error: "First name is required." };
  const isPrimary = form.get("is_primary") === "on";
  if (isPrimary) await supabase.from("contacts").update({ is_primary: false }).eq("customer_id", customerId);
  const { error } = await supabase.from("contacts").insert({
    customer_id: customerId,
    first_name: first,
    last_name: str(form, "last_name"),
    email: str(form, "email"),
    phone: str(form, "phone"),
    title: str(form, "title"),
    is_primary: isPrimary,
  });
  if (error) return { error: friendlyError(error.message) };
  await logActivity(supabase, `added contact ${first} ${str(form, "last_name") ?? ""}`.trim(), { type: "customer", id: customerId });
  revalidatePath(`/customers/${customerId}`);
  return {};
}

export async function makePrimaryContact(form: FormData) {
  return withFlash(async () => {
    const { supabase } = await assertAccess("customers", "edit");
    const id = Number(str(form, "id"));
    const customerId = Number(str(form, "customer_id"));
    must(await supabase.from("contacts").update({ is_primary: false }).eq("customer_id", customerId));
    must(await supabase.from("contacts").update({ is_primary: true }).eq("id", id));
    revalidatePath(`/customers/${customerId}`);
  });
}

export async function deleteContact(form: FormData) {
  return withFlash(async () => {
    const { supabase } = await assertAccess("customers", "full");
    const id = Number(str(form, "id"));
    const customerId = Number(str(form, "customer_id"));
    must(await supabase.from("contacts").delete().eq("id", id));
    revalidatePath(`/customers/${customerId}`);
  });
}
