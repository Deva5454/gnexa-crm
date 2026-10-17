"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logActivity } from "@/lib/activity";
import { assertAccess, denied, requireStaff } from "@/lib/auth";
import { TASK_PRIORITIES, TICKET_STATUSES, ticketNumber } from "@/lib/constants";
import { num, str } from "@/lib/utils";
import { friendlyError, must, withFlash } from "@/lib/flash";
import { discardUpload, fileRow } from "@/lib/uploads";

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
      service_id: num(form, "service_id"),
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
      service_id: num(form, "service_id"),
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

/** Bulk actions from the ticket list. "Merge" folds the selected tickets into the oldest one. */
export async function bulkTickets(form: FormData) {
  return withFlash(async () => {
    const op = str(form, "op") ?? "";
    const ids = [...new Set(form.getAll("ids").map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, 500);
    if (!ids.length) throw new Error("Tick at least one ticket first.");
    const { supabase } = await assertAccess("support", op === "delete" ? "full" : "edit");
    const target = str(form, "target");
    const n = `${ids.length} ticket${ids.length === 1 ? "" : "s"}`;
    switch (op) {
      case "status": {
        if (!TICKET_STATUSES.some((s) => s.value === target)) throw new Error("Pick a status.");
        must(await supabase.from("tickets").update({ status: target!, closed_at: target === "closed" ? new Date().toISOString() : null }).in("id", ids));
        break;
      }
      case "priority":
        if (!TASK_PRIORITIES.some((p) => p.value === target)) throw new Error("Pick a priority.");
        must(await supabase.from("tickets").update({ priority: target! }).in("id", ids));
        break;
      case "department":
        must(await supabase.from("tickets").update({ department_id: Number(target) || null }).in("id", ids));
        break;
      case "service":
        must(await supabase.from("tickets").update({ service_id: Number(target) || null }).in("id", ids));
        break;
      case "assign":
        must(await supabase.from("tickets").update({ assigned_to: target && target !== "none" ? target : null }).in("id", ids));
        break;
      case "tag":
        if (!Number(target)) throw new Error("Pick a tag.");
        must(await supabase.from("taggables").upsert(ids.map((id) => ({ tag_id: Number(target), rel_type: "ticket", rel_id: id })), { ignoreDuplicates: true }));
        break;
      case "merge": {
        if (ids.length < 2) throw new Error("Tick at least two tickets to merge.");
        const [into, ...rest] = [...ids].sort((a, b) => a - b);
        must(await supabase.rpc("merge_tickets", { p_target: into, p_sources: rest }));
        revalidatePath("/support");
        redirect(`/support/${into}`);
      }
      case "delete": {
        const { data: files } = await supabase.from("ticket_files").select("path").in("ticket_id", ids);
        if (files?.length) await supabase.storage.from(TICKET_BUCKET).remove(files.map((f) => f.path));
        must(await supabase.from("tickets").delete().in("id", ids));
        await logActivity(supabase, `deleted ${n}`);
        revalidatePath("/support");
        return;
      }
      default:
        throw new Error("Pick an action.");
    }
    revalidatePath("/support");
    revalidatePath("/dashboard");
  });
}

export async function mergeInto(form: FormData) {
  return withFlash(async () => {
    const { supabase } = await assertAccess("support", "edit");
    const target = Number(str(form, "id"));
    const sources = form.getAll("sources").map(Number).filter((n) => n > 0 && n !== target);
    if (!sources.length) throw new Error("Tick the tickets to merge into this one.");
    must(await supabase.rpc("merge_tickets", { p_target: target, p_sources: sources }));
    revalidatePath("/support");
    revalidatePath(`/support/${target}`);
  });
}

// ───────────── Replies: edit / delete (your own; full access for anyone's) ─────────────
async function ownReply(id: number) {
  const { supabase, profile, can } = await requireStaff();
  const { data: r } = await supabase.from("ticket_replies").select("ticket_id, author_id").eq("id", id).maybeSingle();
  if (!r) throw new Error("Reply not found.");
  if (r.author_id !== profile.id && !can("support", "full")) throw new Error("You can only change your own replies.");
  if (!can("support", "edit")) throw new Error("You need edit access to Support.");
  return { supabase, ticketId: r.ticket_id };
}

export async function editReply(form: FormData) {
  return withFlash(async () => {
    const id = Number(str(form, "id"));
    const body = str(form, "body");
    if (!body) throw new Error("A reply can't be empty.");
    const { supabase, ticketId } = await ownReply(id);
    must(await supabase.from("ticket_replies").update({ body, edited_at: new Date().toISOString() }).eq("id", id));
    revalidatePath(`/support/${ticketId}`);
  });
}

export async function deleteReply(form: FormData) {
  return withFlash(async () => {
    const id = Number(str(form, "id"));
    const { supabase, ticketId } = await ownReply(id);
    const { data: files } = await supabase.from("ticket_files").select("path").eq("reply_id", id);
    if (files?.length) await supabase.storage.from(TICKET_BUCKET).remove(files.map((f) => f.path));
    must(await supabase.from("ticket_replies").delete().eq("id", id));
    revalidatePath(`/support/${ticketId}`);
  });
}

// ───────────── Attachments (uploaded from the browser straight to storage) ─────────────
const TICKET_BUCKET = "ticket-files";

export async function recordTicketFile(input: { rel_id: number; name: string; path: string; size: number; mime: string | null }): Promise<{ error?: string }> {
  const { supabase, can, roleName } = await requireStaff();
  if (!can("support", "edit")) return denied(roleName, "support", "edit");
  const row = fileRow(input);
  const ticketId = Number(input.rel_id);
  if (!row || !row.path.startsWith(`${ticketId}/`)) return { error: "Invalid file." };
  const { error } = await supabase.from("ticket_files").insert({ ticket_id: ticketId, ...row });
  if (error) {
    await discardUpload(supabase, TICKET_BUCKET, "ticket_files", row.path);
    return { error: friendlyError(error.message) };
  }
  revalidatePath(`/support/${ticketId}`);
  return {};
}

export async function deleteTicketFile(form: FormData) {
  return withFlash(async () => {
    const { supabase } = await assertAccess("support", "edit");
    const { data } = await supabase.from("ticket_files").delete().eq("id", Number(str(form, "id"))).select("path, ticket_id").maybeSingle();
    if (!data) throw new Error("Only the uploader, or someone with full support access, can delete this file.");
    await supabase.storage.from(TICKET_BUCKET).remove([data.path]);
    revalidatePath(`/support/${data.ticket_id}`);
  });
}
