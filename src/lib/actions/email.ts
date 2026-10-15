"use server";

import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/activity";
import { denied, requireStaff } from "@/lib/auth";
import { docHref, docNumber, KINDS } from "@/lib/sales";
import { str } from "@/lib/utils";

export type EmailState = { error?: string; ok?: string } | undefined;

// The demo never sends real e-mail: every "send" is written to the e-mail log instead.

export async function sendDocEmail(_: EmailState, form: FormData): Promise<EmailState> {
  const { supabase, can, roleName } = await requireStaff();
  if (!can("sales", "edit")) return denied(roleName, "sales", "edit");
  const id = Number(str(form, "doc_id"));
  const to = str(form, "to");
  const subject = str(form, "subject");
  const body = str(form, "body");
  const kind = str(form, "kind") === "overdue_reminder" ? "overdue_reminder" : "document";
  if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to.split("|")[0]!)) return { error: "Choose who to send it to." };
  if (!subject || !body) return { error: "Subject and message are required." };
  const { data: d } = await supabase.from("sales_docs").select("id, kind, number, status, customer_id, lead_id").eq("id", id).single();
  if (!d) return { error: "Document not found." };
  const [email, name] = to.split("|");
  const { error } = await supabase.from("email_log").insert({
    customer_id: d.customer_id,
    to_email: email,
    to_name: name || null,
    subject,
    body,
    kind,
    rel_type: "sales_doc",
    rel_id: id,
  });
  if (error) return { error: error.message };
  if (d.status === "draft") await supabase.from("sales_docs").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", id);
  if (kind === "overdue_reminder") await supabase.from("sales_docs").update({ last_reminder_at: new Date().toISOString() }).eq("id", id);
  const label = docNumber(d.kind, d.number);
  const what = kind === "overdue_reminder" ? `sent an overdue reminder for ${label}` : `e-mailed ${KINDS[d.kind].label.toLowerCase()} ${label}`;
  if (d.customer_id) await logActivity(supabase, `${what} to ${name || email}`, { type: "customer", id: d.customer_id });
  else if (d.lead_id) await logActivity(supabase, `${what} to ${name || email}`, { type: "lead", id: d.lead_id });
  revalidatePath(docHref(d.kind, id));
  revalidatePath(`/sales/${KINDS[d.kind].slug}`);
  return { ok: `Logged as sent to ${email}. (Demo — no real e-mail goes out.)` };
}

export async function sendStatementEmail(_: EmailState, form: FormData): Promise<EmailState> {
  const { supabase, can, roleName } = await requireStaff();
  if (!can("sales", "edit")) return denied(roleName, "sales", "edit");
  const customerId = Number(str(form, "customer_id"));
  const to = str(form, "to");
  const subject = str(form, "subject");
  const body = str(form, "body");
  if (!to) return { error: "This customer has no contact with an e-mail address." };
  if (!subject || !body) return { error: "Subject and message are required." };
  const [email, name] = to.split("|");
  const { error } = await supabase.from("email_log").insert({ customer_id: customerId, to_email: email, to_name: name || null, subject, body, kind: "statement", rel_type: "customer", rel_id: customerId });
  if (error) return { error: error.message };
  await logActivity(supabase, `e-mailed an account statement to ${name || email}`, { type: "customer", id: customerId });
  revalidatePath(`/customers/${customerId}/statement`);
  return { ok: `Statement logged as sent to ${email}. (Demo — no real e-mail goes out.)` };
}
