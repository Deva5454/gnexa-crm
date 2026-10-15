"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logActivity } from "@/lib/activity";
import { assertAccess, denied, requireStaff } from "@/lib/auth";
import { contractNumber } from "@/lib/constants";
import { num, str } from "@/lib/utils";

export type FormState = { error?: string; ok?: string } | undefined;

export async function saveContract(id: number | null, _: FormState, form: FormData): Promise<FormState> {
  const { supabase, can, roleName } = await requireStaff();
  if (!can("contracts", "edit")) return denied(roleName, "contracts", "edit");
  const fields = {
    customer_id: num(form, "customer_id") ?? 0,
    type_id: num(form, "type_id"),
    subject: str(form, "subject") ?? "",
    value: num(form, "value"),
    start_date: str(form, "start_date") ?? new Date().toISOString().slice(0, 10),
    end_date: str(form, "end_date"),
    content: str(form, "content"),
  };
  if (!fields.customer_id) return { error: "Choose a customer." };
  if (!fields.subject) return { error: "Subject is required." };
  if (fields.end_date && fields.end_date < fields.start_date) return { error: "End date can't be before the start date." };
  let contractId = id;
  if (id) {
    const { error } = await supabase.from("contracts").update(fields).eq("id", id);
    if (error) return { error: error.message };
  } else {
    const { data, error } = await supabase.from("contracts").insert(fields).select("id").single();
    if (error) return { error: error.message };
    contractId = data.id;
    await logActivity(supabase, `drafted contract ${contractNumber(data.id)} “${fields.subject}”`, { type: "customer", id: fields.customer_id });
  }
  revalidatePath("/contracts");
  redirect(`/contracts/${contractId}`);
}

export async function setContractStatus(form: FormData) {
  const { supabase } = await assertAccess("contracts", "edit");
  const id = Number(str(form, "id"));
  const status = str(form, "status");
  if (!status || !["draft", "sent", "cancelled"].includes(status)) return;
  const { data } = await supabase.from("contracts").update({ status, ...(status === "draft" ? { signed_by: null, signed_at: null } : {}) }).eq("id", id).select("customer_id").single();
  const verb = status === "sent" ? "sent for signature" : status === "cancelled" ? "cancelled" : "reopened as draft";
  if (data) await logActivity(supabase, `${verb} contract ${contractNumber(id)}`, { type: "customer", id: data.customer_id });
  revalidatePath(`/contracts/${id}`);
  revalidatePath("/contracts");
}

/** Record the customer's signature (name + date). Online customer signing comes with the client portal. */
export async function signContract(_: FormState, form: FormData): Promise<FormState> {
  const { supabase, can, roleName } = await requireStaff();
  if (!can("contracts", "edit")) return denied(roleName, "contracts", "edit");
  const id = Number(str(form, "id"));
  const signer = str(form, "signed_by");
  const date = str(form, "signed_on") ?? new Date().toISOString().slice(0, 10);
  if (!signer) return { error: "Enter the name of the person who signed." };
  if (form.get("confirm") !== "on") return { error: "Confirm that you hold the signed copy." };
  const { data, error } = await supabase
    .from("contracts")
    .update({ status: "signed", signed_by: signer, signed_at: new Date(`${date}T12:00:00`).toISOString() })
    .eq("id", id)
    .select("customer_id")
    .single();
  if (error) return { error: error.message };
  await logActivity(supabase, `recorded ${signer}'s signature on contract ${contractNumber(id)}`, { type: "customer", id: data.customer_id });
  revalidatePath(`/contracts/${id}`);
  revalidatePath("/contracts");
  return { ok: "Signature recorded." };
}

/** Copy a contract into a new draft that starts the day after it ends. */
export async function renewContract(form: FormData) {
  const { supabase } = await assertAccess("contracts", "edit");
  const id = Number(str(form, "id"));
  const { data: c } = await supabase.from("contracts").select("*").eq("id", id).single();
  if (!c) throw new Error("Contract not found.");
  const start = c.end_date ? new Date(new Date(c.end_date).getTime() + 86400_000) : new Date();
  const end = c.end_date ? new Date(start.getTime() + (new Date(c.end_date).getTime() - new Date(c.start_date).getTime())) : null;
  const { data, error } = await supabase
    .from("contracts")
    .insert({
      customer_id: c.customer_id,
      type_id: c.type_id,
      subject: `${c.subject} (renewal)`,
      value: c.value,
      start_date: start.toISOString().slice(0, 10),
      end_date: end ? end.toISOString().slice(0, 10) : null,
      content: c.content,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  await logActivity(supabase, `drafted renewal ${contractNumber(data.id)} of ${contractNumber(id)}`, { type: "customer", id: c.customer_id });
  revalidatePath("/contracts");
  redirect(`/contracts/${data.id}`);
}

export async function deleteContract(form: FormData) {
  const { supabase } = await assertAccess("contracts", "full");
  await supabase.from("contracts").delete().eq("id", Number(str(form, "id")));
  revalidatePath("/contracts");
  redirect("/contracts");
}
