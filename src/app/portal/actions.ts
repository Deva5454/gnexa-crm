"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePortal } from "@/lib/auth";
import { num, str } from "@/lib/utils";

export type PortalState = { error?: string; ok?: string } | undefined;

// Every action goes through a database function that re-checks the record belongs to this client.

export async function respondToQuote(_: PortalState, form: FormData): Promise<PortalState> {
  const { supabase } = await requirePortal();
  const id = Number(str(form, "id"));
  const accept = str(form, "decision") === "accept";
  const { error } = await supabase.rpc("portal_respond", { p_doc: id, p_accept: accept });
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
