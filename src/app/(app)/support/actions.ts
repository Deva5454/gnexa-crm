"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logActivity } from "@/lib/activity";
import { assertAccess, denied, requireStaff } from "@/lib/auth";
import { TASK_PRIORITIES, TICKET_STATUSES, ticketNumber } from "@/lib/constants";
import { num, str } from "@/lib/utils";
import { friendlyError, must, withFlash } from "@/lib/flash";

export type FormState = { error?: string; ok?: string } | undefined;

const PRIORITY = (v: string | null) => (TASK_PRIORITIES.some((p) => p.value === v) ? v! : "medium");

export async function createTicket(_: FormState, form: FormData): Promise<FormState> {
  const { supabase, profile, can, roleName } = await requireStaff();
  if (!can("support", "edit")) return denied(roleName, "support", "edit");
  const subject = str(form, "subject");
  const body = str(form, "body");
  const customer_id = num(form, "customer_id");
  if (!subject) return { error: "Subject is required." };
  if (!body) return { error: "Describe the issue." };
  const contact_id = num(form, "contact_id");
  const { data: t, error } = await supabase
    .from("tickets")
    .insert({
      subject,
      customer_id,
      contact_id,
      department_id: num(form, "department_id"),
      project_id: num(form, "project_id"),
      priority: PRIORITY(str(form, "priority")),
      assigned_to: str(form, "assigned_to"),
    })
    .select("id")
    .single();
  if (error) return { error: friendlyError(error.message) };

  // The opening message is from the customer's contact when one is chosen, otherwise from staff
  let authorName: string | null = null;
  if (contact_id) {
    const { data: c } = await supabase.from("contacts").select("first_name, last_name").eq("id", contact_id).single();
    authorName = c ? [c.first_name, c.last_name].filter(Boolean).join(" ") : null;
  }
  await supabase.from("ticket_replies").insert({ ticket_id: t.id, body, author_name: authorName, author_id: authorName ? null : profile.id });
  if (customer_id) await logActivity(supabase, `opened ticket ${ticketNumber(t.id)} “${subject}”`, { type: "customer", id: customer_id });
  revalidatePath("/support");
  redirect(`/support/${t.id}`);
}

/** mode: reply (to customer) | note (internal) | customer (log a message the customer sent by email/phone) */
export async function addReply(_: FormState, form: FormData): Promise<FormState> {
  const { supabase, profile, can, roleName } = await requireStaff();
  if (!can("support", "edit")) return denied(roleName, "support", "edit");
  const ticketId = Number(str(form, "ticket_id"));
  const body = str(form, "body");
  const mode = str(form, "mode") ?? "reply";
  if (!body) return { error: "Write something first." };

  const { data: t } = await supabase.from("tickets").select("status, contact:contacts(first_name, last_name)").eq("id", ticketId).single();
  if (!t) return { error: "Ticket not found." };
  const contactName = t.contact ? [t.contact.first_name, t.contact.last_name].filter(Boolean).join(" ") : "Customer";

  const { error } = await supabase.from("ticket_replies").insert({
    ticket_id: ticketId,
    body,
    is_internal: mode === "note",
    author_id: mode === "customer" ? null : profile.id,
    author_name: mode === "customer" ? contactName : null,
  });
  if (error) return { error: friendlyError(error.message) };

  // Status follows the conversation: staff reply → answered, customer message → open (re-opens closed tickets)
  const next = mode === "reply" ? (str(form, "close") === "1" ? "closed" : "answered") : mode === "customer" ? "open" : t.status;
  await supabase
    .from("tickets")
    .update({
      status: next,
      last_reply_at: new Date().toISOString(),
      closed_at: next === "closed" ? new Date().toISOString() : null,
      ...(mode === "reply" && t.status === "open" ? { assigned_to: profile.id } : {}),
    })
    .eq("id", ticketId);
  revalidatePath(`/support/${ticketId}`);
  revalidatePath("/support");
  return { ok: mode === "note" ? "Note added." : mode === "customer" ? "Customer message logged." : "Reply sent." };
}

export async function updateTicket(form: FormData) {
  return withFlash(async () => {
    const { supabase } = await assertAccess("support", "edit");
    const id = Number(str(form, "id"));
    const status = str(form, "status");
    const patch = {
      status: TICKET_STATUSES.some((s) => s.value === status) ? status! : "open",
      priority: PRIORITY(str(form, "priority")),
      department_id: num(form, "department_id"),
      assigned_to: str(form, "assigned_to"),
      project_id: num(form, "project_id"),
      closed_at: status === "closed" ? new Date().toISOString() : null,
    };
    must(await supabase.from("tickets").update(patch).eq("id", id));
    revalidatePath(`/support/${id}`);
    revalidatePath("/support");
  });
}

export async function deleteTicket(form: FormData) {
  return withFlash(async () => {
    const { supabase } = await assertAccess("support", "full");
    must(await supabase.from("tickets").delete().eq("id", Number(str(form, "id"))));
    revalidatePath("/support");
    redirect("/support");
  });
}
