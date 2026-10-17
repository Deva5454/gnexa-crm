"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePortal } from "@/lib/auth";
import { fileRow } from "@/lib/uploads";
import { num, str } from "@/lib/utils";

export type PortalState = { error?: string; ok?: string } | undefined;

// Every action goes through a database function that re-checks the record belongs to this client.

export async function respondToQuote(_: PortalState, form: FormData): Promise<PortalState> {
  const { supabase } = await requirePortal();
  const id = Number(str(form, "id"));
  const accept = str(form, "decision") === "accept";
  const name = str(form, "name");
  if (accept && !name) return { error: "Type your full name to accept." };
  if (accept && form.get("agree") !== "on") return { error: "Tick the box to confirm you accept." };
  const { error } = await supabase.rpc("portal_respond", { p_doc: id, p_accept: accept, p_name: name });
  if (error) return { error: error.message };
  revalidatePath(`/portal/quotes/${id}`);
  revalidatePath("/portal");
  return { ok: accept ? "Thank you — we've received your acceptance." : "Thanks for letting us know." };
}

export async function signContract(_: PortalState, form: FormData): Promise<PortalState> {
  const { supabase } = await requirePortal();
  const id = Number(str(form, "id"));
  if (form.get("agree") !== "on") return { error: "Tick the box to agree to the terms." };
  const { error } = await supabase.rpc("portal_sign_contract", { p_contract: id, p_name: str(form, "name") ?? "" });
  if (error) return { error: error.message };
  revalidatePath(`/portal/contracts/${id}`);
  revalidatePath("/portal");
  return { ok: "Signed. A copy is available to download." };
}

export async function openTicket(_: PortalState, form: FormData): Promise<PortalState> {
  const { supabase } = await requirePortal();
  const { data, error } = await supabase.rpc("portal_open_ticket", {
    p_subject: str(form, "subject") ?? "",
    p_body: str(form, "body") ?? "",
    p_department: num(form, "department_id"),
    p_priority: str(form, "priority") ?? "medium",
  });
  if (error) return { error: error.message };
  revalidatePath("/portal/tickets");
  redirect(`/portal/tickets/${data}`);
}

export async function replyToTicket(_: PortalState, form: FormData): Promise<PortalState> {
  const { supabase } = await requirePortal();
  const id = Number(str(form, "id"));
  const { error } = await supabase.rpc("portal_reply", { p_ticket: id, p_body: str(form, "body") ?? "" });
  if (error) return { error: error.message };
  revalidatePath(`/portal/tickets/${id}`);
  return { ok: "Sent." };
}

export async function trackArticle(id: number, event: "view" | "yes" | "no") {
  const { supabase } = await requirePortal();
  await supabase.rpc("kb_track", { p_article: id, p_event: event });
}

export async function payInvoice(_: PortalState, form: FormData): Promise<PortalState> {
  const { supabase } = await requirePortal();
  const id = Number(str(form, "id"));
  const amount = num(form, "amount");
  const method = str(form, "method") ?? "upi";
  if (!amount || amount <= 0) return { error: "Enter an amount to pay." };
  const { data, error } = await supabase.rpc("portal_pay", { p_invoice: id, p_amount: amount, p_method: method });
  if (error) return { error: error.message };
  revalidatePath(`/portal/invoices/${id}`);
  revalidatePath("/portal/invoices");
  revalidatePath("/portal");
  return { ok: `Payment successful. Reference ${data}.` };
}

export async function setConsent(_: PortalState, form: FormData): Promise<PortalState> {
  const { supabase } = await requirePortal();
  const { error } = await supabase.rpc("portal_set_consent", { p_consent: form.get("consent") === "on" });
  if (error) return { error: error.message };
  revalidatePath("/portal/privacy");
  return { ok: "Preference saved." };
}

export async function requestPrivacy(_: PortalState, form: FormData): Promise<PortalState> {
  const { supabase } = await requirePortal();
  const kind = str(form, "kind") === "erasure" ? "erasure" : "export";
  const { error } = await supabase.rpc("portal_gdpr_request", { p_kind: kind, p_note: str(form, "note") });
  if (error) return { error: error.message };
  revalidatePath("/portal/privacy");
  return { ok: kind === "erasure" ? "Request received. We'll confirm by e-mail once your details are removed." : "Request received." };
}

export async function closeTicketPortal(form: FormData) {
  const { supabase } = await requirePortal();
  const id = Number(str(form, "id"));
  const { error } = await supabase.rpc("portal_close_ticket", { p_ticket: id });
  if (error) throw new Error(error.message);
  revalidatePath(`/portal/tickets/${id}`);
  revalidatePath("/portal/tickets");
}

/** A file the client uploaded (browser → private bucket) on one of their open tickets. The database re-checks ownership. */
export async function recordPortalTicketFile(input: { rel_id: number; name: string; path: string; size: number; mime: string | null }): Promise<{ error?: string }> {
  const { supabase, user } = await requirePortal();
  const row = fileRow(input);
  const ticketId = Number(input.rel_id);
  if (!row || !row.path.startsWith(`${ticketId}/`)) return { error: "Invalid file." };
  const { error } = await supabase.from("ticket_files").insert({ ticket_id: ticketId, ...row, from_customer: true, uploaded_by: user.id });
  if (error) {
    await supabase.storage.from("ticket-files").remove([row.path]);
    return { error: "Couldn't attach the file to this ticket." };
  }
  revalidatePath(`/portal/tickets/${ticketId}`);
  return {};
}

export async function commentOnContract(_: PortalState, form: FormData): Promise<PortalState> {
  const { supabase } = await requirePortal();
  const id = Number(str(form, "id"));
  const { error } = await supabase.rpc("portal_contract_comment", { p_contract: id, p_body: str(form, "body") ?? "" });
  if (error) return { error: error.message };
  revalidatePath(`/portal/contracts/${id}`);
  return { ok: "Sent." };
}

/** The client ends one of their subscriptions at the close of the current period, or changes their mind. */
export async function portalSubscriptionEnd(form: FormData) {
  const { supabase } = await requirePortal();
  const id = Number(str(form, "id"));
  const { error } = await supabase.rpc("subscription_cancel_at_end", { p_id: id, p_undo: str(form, "undo") === "1" });
  if (error) throw new Error(error.message);
  revalidatePath("/portal/subscriptions");
  revalidatePath("/portal/invoices");
}
