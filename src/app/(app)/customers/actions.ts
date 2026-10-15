"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logActivity } from "@/lib/activity";
import { assertAccess, denied, requireStaff } from "@/lib/auth";
import { num, str } from "@/lib/utils";

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
  if (error) return { error: error.message };

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
  if (error) return { error: error.message };
  await logActivity(supabase, `updated customer "${fields.company}"`, { type: "customer", id });
  revalidatePath(`/customers/${id}`);
  redirect(`/customers/${id}`);
}

export async function toggleCustomerActive(form: FormData) {
  const { supabase } = await assertAccess("customers", "edit");
  const id = Number(str(form, "id"));
  const active = str(form, "active") === "1";
  await supabase.from("customers").update({ is_active: active }).eq("id", id);
  await logActivity(supabase, `marked customer ${active ? "active" : "inactive"}`, { type: "customer", id });
  revalidatePath(`/customers/${id}`);
  revalidatePath("/customers");
}

export async function deleteCustomer(form: FormData) {
  const { supabase } = await assertAccess("customers", "full");
  const id = Number(str(form, "id"));
  await supabase.from("tasks").delete().eq("rel_type", "customer").eq("rel_id", id);
  await supabase.from("notes").delete().eq("rel_type", "customer").eq("rel_id", id);
  await supabase.from("customers").delete().eq("id", id);
  revalidatePath("/customers");
  redirect("/customers");
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
  if (error) return { error: error.message };
  await logActivity(supabase, `added contact ${first} ${str(form, "last_name") ?? ""}`.trim(), { type: "customer", id: customerId });
  revalidatePath(`/customers/${customerId}`);
  return {};
}

export async function makePrimaryContact(form: FormData) {
  const { supabase } = await assertAccess("customers", "edit");
  const id = Number(str(form, "id"));
  const customerId = Number(str(form, "customer_id"));
  await supabase.from("contacts").update({ is_primary: false }).eq("customer_id", customerId);
  await supabase.from("contacts").update({ is_primary: true }).eq("id", id);
  revalidatePath(`/customers/${customerId}`);
}

export async function deleteContact(form: FormData) {
  const { supabase } = await assertAccess("customers", "full");
  const id = Number(str(form, "id"));
  const customerId = Number(str(form, "customer_id"));
  await supabase.from("contacts").delete().eq("id", id);
  revalidatePath(`/customers/${customerId}`);
}
