"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logActivity } from "@/lib/activity";
import { assertAccess, denied, requireStaff } from "@/lib/auth";
import { contractNumber } from "@/lib/constants";
import { num, str } from "@/lib/utils";
import { friendlyError, must, withFlash } from "@/lib/flash";
import { todayIST } from "@/lib/dates";
import { addDays } from "@/lib/sales";
import { discardUpload, fileRow } from "@/lib/uploads";

export type FormState = { error?: string; ok?: string } | undefined;

export async function saveContract(id: number | null, _: FormState, form: FormData): Promise<FormState> {
  const { supabase, can, roleName } = await requireStaff();
  if (!can("contracts", "edit")) return denied(roleName, "contracts", "edit");
  const fields = {
    customer_id: num(form, "customer_id") ?? 0,
    type_id: num(form, "type_id"),
    subject: str(form, "subject") ?? "",
    value: num(form, "value"),
    start_date: str(form, "start_date") ?? todayIST(),
    end_date: str(form, "end_date"),
    content: str(form, "content"),
    project_id: num(form, "project_id"),
    visible_to_client: form.get("visible_to_client") === "on",
  };
  if (!fields.customer_id) return { error: "Choose a customer." };
  if (!fields.subject) return { error: "Subject is required." };
  if (fields.end_date && fields.end_date < fields.start_date) return { error: "End date can't be before the start date." };
  let contractId = id;
  if (id) {
    const { data: cur } = await supabase.from("contracts").select("status").eq("id", id).single();
    if (cur?.status === "signed") return { error: "This contract is signed — reopen it as a draft (which clears the signature) before changing its terms." };
    const { error } = await supabase.from("contracts").update(fields).eq("id", id);
    if (error) return { error: friendlyError(error.message) };
  } else {
    const { data, error } = await supabase.from("contracts").insert(fields).select("id").single();
    if (error) return { error: friendlyError(error.message) };
    contractId = data.id;
    await logActivity(supabase, `drafted contract ${contractNumber(data.id)} “${fields.subject}”`, { type: "customer", id: fields.customer_id });
  }
  revalidatePath("/contracts");
  redirect(`/contracts/${contractId}`);
}

export async function setContractStatus(form: FormData) {
  return withFlash(async () => {
    const { supabase } = await assertAccess("contracts", "edit");
    const id = Number(str(form, "id"));
    const status = str(form, "status");
    if (!status || !["draft", "sent", "cancelled"].includes(status)) return;
    const { data } = await supabase.from("contracts").update({ status, ...(status === "draft" ? { signed_by: null, signed_at: null } : {}) }).eq("id", id).select("customer_id").single();
    const verb = status === "sent" ? "sent for signature" : status === "cancelled" ? "cancelled" : "reopened as draft";
    if (data) await logActivity(supabase, `${verb} contract ${contractNumber(id)}`, { type: "customer", id: data.customer_id });
    revalidatePath(`/contracts/${id}`);
    revalidatePath("/contracts");
  });
}

/** Record the customer's signature (name + date). Online customer signing comes with the client portal. */
export async function signContract(_: FormState, form: FormData): Promise<FormState> {
  const { supabase, can, roleName } = await requireStaff();
  if (!can("contracts", "edit")) return denied(roleName, "contracts", "edit");
  const id = Number(str(form, "id"));
  const signer = str(form, "signed_by");
  const date = str(form, "signed_on") ?? todayIST();
  if (!signer) return { error: "Enter the name of the person who signed." };
  if (form.get("confirm") !== "on") return { error: "Confirm that you hold the signed copy." };
  const { data, error } = await supabase
    .from("contracts")
    .update({ status: "signed", signed_by: signer, signed_at: new Date(`${date}T12:00:00`).toISOString() })
    .eq("id", id)
    .select("customer_id")
    .single();
  if (error) return { error: friendlyError(error.message) };
  await logActivity(supabase, `recorded ${signer}'s signature on contract ${contractNumber(id)}`, { type: "customer", id: data.customer_id });
  revalidatePath(`/contracts/${id}`);
  revalidatePath("/contracts");
  return { ok: "Signature recorded." };
}

/** Perfex "Renew contract": new dates and value on the same contract, with the old term kept in the renewal history. */
export async function renewContract(_: FormState, form: FormData): Promise<FormState> {
  const { supabase, can, roleName } = await requireStaff();
  if (!can("contracts", "edit")) return denied(roleName, "contracts", "edit");
  const id = Number(str(form, "id"));
  const start = str(form, "start_date");
  if (!start) return { error: "Choose the new start date." };
  const { error } = await supabase.rpc("renew_contract", {
    p_contract: id,
    p_start: start,
    p_end: str(form, "end_date"),
    p_value: num(form, "value"),
    p_keep_signature: form.get("keep_signature") === "on",
  });
  if (error) return { error: friendlyError(error.message) };
  revalidatePath(`/contracts/${id}`);
  revalidatePath("/contracts");
  return { ok: "Renewed." };
}

/** Copy a contract into a new draft starting today, for the same length of time. */
export async function copyContract(form: FormData) {
  return withFlash(async () => {
    const { supabase } = await assertAccess("contracts", "edit");
    const id = Number(str(form, "id"));
    const { data: c } = await supabase.from("contracts").select("*").eq("id", id).single();
    if (!c) throw new Error("Contract not found.");
    const start = todayIST();
    const days = c.end_date ? Math.round((Date.parse(c.end_date) - Date.parse(c.start_date)) / 86400_000) : null;
    const { data, error } = await supabase
      .from("contracts")
      .insert({
        customer_id: c.customer_id,
        type_id: c.type_id,
        project_id: c.project_id,
        subject: `${c.subject} (copy)`.slice(0, 250),
        value: c.value,
        start_date: start,
        end_date: days != null ? addDays(start, days) : null,
        content: c.content,
        visible_to_client: c.visible_to_client,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await logActivity(supabase, `copied contract ${contractNumber(id)} to ${contractNumber(data.id)}`, { type: "customer", id: c.customer_id });
    revalidatePath("/contracts");
    redirect(`/contracts/${data.id}/edit`);
  });
}

// ───────────── Discussion with the customer ─────────────
export async function addContractComment(_: FormState, form: FormData): Promise<FormState> {
  const { supabase, profile, can, roleName } = await requireStaff();
  if (!can("contracts", "edit")) return denied(roleName, "contracts", "edit");
  const id = Number(str(form, "contract_id"));
  const body = str(form, "body");
  if (!body) return { error: "Write a comment first." };
  const { error } = await supabase.from("contract_comments").insert({ contract_id: id, body: body.slice(0, 4000), staff_id: profile.id });
  if (error) return { error: friendlyError(error.message) };
  revalidatePath(`/contracts/${id}`);
  return { ok: "Posted." };
}

export async function deleteContractComment(form: FormData) {
  return withFlash(async () => {
    const { supabase } = await assertAccess("contracts", "edit");
    const { data } = await supabase.from("contract_comments").delete().eq("id", Number(str(form, "id"))).select("contract_id").maybeSingle();
    if (!data) throw new Error("Only the author, or someone with full contract access, can delete this comment.");
    revalidatePath(`/contracts/${data.contract_id}`);
  });
}

// ───────────── Attachments (staff only) ─────────────
const CONTRACT_BUCKET = "contract-files";

export async function recordContractFile(input: { rel_id: number; name: string; path: string; size: number; mime: string | null }): Promise<{ error?: string }> {
  const { supabase, can, roleName } = await requireStaff();
  if (!can("contracts", "edit")) return denied(roleName, "contracts", "edit");
  const row = fileRow(input);
  const id = Number(input.rel_id);
  if (!row || !row.path.startsWith(`${id}/`)) return { error: "Invalid file." };
  const { error } = await supabase.from("contract_files").insert({ contract_id: id, ...row });
  if (error) {
    await discardUpload(supabase, CONTRACT_BUCKET, "contract_files", row.path);
    return { error: friendlyError(error.message) };
  }
  revalidatePath(`/contracts/${id}`);
  return {};
}

export async function deleteContractFile(form: FormData) {
  return withFlash(async () => {
    const { supabase } = await assertAccess("contracts", "edit");
    const { data } = await supabase.from("contract_files").delete().eq("id", Number(str(form, "id"))).select("path, contract_id").maybeSingle();
    if (!data) throw new Error("Only the uploader, or someone with full contract access, can delete this file.");
    await supabase.storage.from(CONTRACT_BUCKET).remove([data.path]);
    revalidatePath(`/contracts/${data.contract_id}`);
  });
}

// ───────────── E-mail (logged, demo) ─────────────
export async function sendContractEmail(_: FormState, form: FormData): Promise<FormState> {
  const { supabase, can, roleName } = await requireStaff();
  if (!can("contracts", "edit")) return denied(roleName, "contracts", "edit");
  const id = Number(str(form, "contract_id"));
  const to = str(form, "to");
  const subject = str(form, "subject");
  const body = str(form, "body");
  const reminder = str(form, "kind") === "contract_expiry";
  if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to.split("|")[0]!)) return { error: "Choose who to send it to." };
  if (!subject || !body) return { error: "Subject and message are required." };
  const { data: c } = await supabase.from("contracts").select("id, status, customer_id").eq("id", id).single();
  if (!c) return { error: "Contract not found." };
  const [email, name] = to.split("|");
  const { error } = await supabase.from("email_log").insert({
    customer_id: c.customer_id,
    to_email: email,
    to_name: name || null,
    subject,
    body,
    kind: reminder ? "contract_expiry" : "document",
    rel_type: "contract",
    rel_id: id,
  });
  if (error) return { error: friendlyError(error.message) };
  // Sending a draft puts it in front of the customer for signature
  if (!reminder && c.status === "draft") await supabase.from("contracts").update({ status: "sent" }).eq("id", id);
  if (reminder) await supabase.from("contracts").update({ expiry_reminded_at: new Date().toISOString() }).eq("id", id);
  await logActivity(supabase, `${reminder ? "sent an expiry reminder for" : "e-mailed"} contract ${contractNumber(id)} to ${name || email}`, { type: "customer", id: c.customer_id });
  revalidatePath(`/contracts/${id}`);
  revalidatePath("/contracts");
  return { ok: `Logged as sent to ${email}. (Demo — no real e-mail goes out.)` };
}

export async function deleteContract(form: FormData) {
  return withFlash(async () => {
    const { supabase } = await assertAccess("contracts", "full");
    must(await supabase.from("contracts").delete().eq("id", Number(str(form, "id"))));
    revalidatePath("/contracts");
    redirect("/contracts");
  });
}
