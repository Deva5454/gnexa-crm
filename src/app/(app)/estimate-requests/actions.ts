"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logActivity } from "@/lib/activity";
import { assertAccess, denied, requireStaff } from "@/lib/auth";
import type { EmailState } from "@/lib/actions/email";
import { renderTemplate } from "@/lib/email-templates";
import { friendlyError, must, withFlash } from "@/lib/flash";
import { companySettings } from "@/lib/sales-data";
import { str } from "@/lib/utils";

/** Status / assignee from the request page; optionally e-mails the requester about a new status. */
export async function updateEstimateRequest(form: FormData) {
  return withFlash(async () => {
    const { supabase, profile } = await assertAccess("sales", "edit");
    const id = Number(str(form, "id"));
    const status = str(form, "status");
    const { data: before } = await supabase.from("estimate_requests").select("name, email, status").eq("id", id).single();
    // the status must be one of Setup → Estimate request → Statuses (enforced by the database)
    must(await supabase.from("estimate_requests").update({ ...(status ? { status } : {}), assigned_to: str(form, "assigned_to") }).eq("id", id));
    if (status && before && status !== before.status && before.email && form.get("notify") === "on") {
      const [{ data: st }, company] = await Promise.all([
        supabase.from("estimate_request_statuses").select("name").eq("key", status).maybeSingle(),
        companySettings(supabase),
      ]);
      const tpl = await renderTemplate(supabase, "estimate_request_status", {
        name: before.name.split(" ")[0] || before.name,
        status: st?.name ?? status,
        company_name: company?.company_name ?? "",
        staff_name: profile.full_name ?? "",
      });
      if (tpl) must(await supabase.from("email_log").insert({ to_email: before.email, to_name: before.name, subject: tpl.subject, body: tpl.body, kind: "manual", rel_type: "estimate_request", rel_id: id }));
    }
    revalidatePath(`/estimate-requests/${id}`);
    revalidatePath("/estimate-requests");
  });
}

/** Board: drag a request to another status column. */
export async function moveRequestStatus(id: number, status: string): Promise<{ error?: string } | void> {
  const { supabase, can, roleName } = await requireStaff();
  if (!can("sales", "edit")) return denied(roleName, "sales", "edit");
  const { error } = await supabase.from("estimate_requests").update({ status }).eq("id", id);
  if (error) return { error: friendlyError(error.message) };
  revalidatePath("/estimate-requests");
  revalidatePath(`/estimate-requests/${id}`);
}

/** Bulk actions from the list: change status, assign, delete. */
export async function bulkEstimateRequests(form: FormData) {
  return withFlash(async () => {
    const op = str(form, "op") ?? "";
    const ids = [...new Set(form.getAll("ids").map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, 500);
    if (!ids.length) throw new Error("Tick at least one request first.");
    const { supabase } = await assertAccess("sales", op === "delete" ? "full" : "edit");
    const target = str(form, "target");
    switch (op) {
      case "status":
        if (!target) throw new Error("Pick a status.");
        must(await supabase.from("estimate_requests").update({ status: target }).in("id", ids));
        break;
      case "assign":
        must(await supabase.from("estimate_requests").update({ assigned_to: target && target !== "none" ? target : null }).in("id", ids));
        break;
      case "delete":
        must(await supabase.from("estimate_requests").delete().in("id", ids));
        break;
      default:
        throw new Error("Pick an action.");
    }
    revalidatePath("/estimate-requests");
  });
}

/** Turn the request into a lead (once), then jump to a new proposal for it. */
export async function requestToProposal(form: FormData) {
  return withFlash(async () => {
    const { supabase, profile } = await assertAccess("sales", "edit");
    const id = Number(str(form, "id"));
    const { data: r } = await supabase.from("estimate_requests").select("*").eq("id", id).single();
    if (!r) throw new Error("Request not found.");
    let leadId = r.lead_id;
    if (!leadId) {
      const [{ data: status }, { data: source }] = await Promise.all([
        supabase.from("lead_statuses").select("id").order("sort_order").limit(1).maybeSingle(),
        supabase.from("lead_sources").select("id").eq("name", "Website").maybeSingle(),
      ]);
      const { data: lead, error } = await supabase
        .from("leads")
        .insert({
          name: r.name,
          company: r.company,
          email: r.email,
          phone: r.phone,
          description: [r.message, r.budget ? `Budget: ${r.budget}` : null].filter(Boolean).join("\n\n") || null,
          status_id: status?.id ?? null,
          source_id: source?.id ?? null,
          assigned_to: r.assigned_to ?? profile.id,
          position: Date.now() / 1000,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      leadId = lead.id;
      await logActivity(supabase, `created this lead from an estimate request`, { type: "lead", id: leadId });
    }
    must(await supabase.from("estimate_requests").update({ lead_id: leadId, status: r.status === "new" ? "in_review" : r.status }).eq("id", id));
    revalidatePath("/estimate-requests");
    if (str(form, "then") === "lead") redirect(`/leads/${leadId}`);
    redirect(`/sales/proposals/new?lead=${leadId}`);
  });
}

/**
 * Perfex "Convert to estimate": estimates are for customers, so use the customer this request already points at,
 * else one with the same company name, else create the customer (and the requester as its primary contact).
 */
export async function requestToEstimate(form: FormData) {
  return withFlash(async () => {
    const { supabase } = await assertAccess("sales", "edit");
    const id = Number(str(form, "id"));
    const { data: r } = await supabase.from("estimate_requests").select("*").eq("id", id).single();
    if (!r) throw new Error("Request not found.");
    let customerId = r.customer_id;
    if (!customerId) {
      const company = (r.company ?? "").trim() || r.name;
      const { data: existing } = await supabase.from("customers").select("id").ilike("company", company.replace(/[\\%_]/g, "")).limit(1).maybeSingle();
      if (existing) customerId = existing.id;
      else {
        const { data: c, error } = await supabase.from("customers").insert({ company, phone: r.phone }).select("id").single();
        if (error) throw new Error(friendlyError(error.message));
        customerId = c.id;
        const [first, ...rest] = r.name.trim().split(/\s+/);
        must(await supabase.from("contacts").insert({ customer_id: customerId, first_name: first || r.name, last_name: rest.join(" ") || null, email: r.email, phone: r.phone, is_primary: true }));
        await logActivity(supabase, `created this customer from an estimate request`, { type: "customer", id: customerId });
      }
    }
    must(await supabase.from("estimate_requests").update({ customer_id: customerId, status: r.status === "new" ? "in_review" : r.status }).eq("id", id));
    revalidatePath("/estimate-requests");
    redirect(`/sales/estimates/new?customer=${customerId}`);
  });
}

/** Reply to the requester (logged in the e-mail log; the demo never sends real mail). */
export async function sendRequestEmail(_: EmailState, form: FormData): Promise<EmailState> {
  const { supabase, can, roleName } = await requireStaff();
  if (!can("sales", "edit")) return denied(roleName, "sales", "edit");
  const id = Number(str(form, "request_id"));
  const to = str(form, "to");
  const subject = str(form, "subject");
  const body = str(form, "body");
  const [email, name] = (to ?? "").split("|");
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "This request has no valid e-mail address." };
  if (!subject || !body) return { error: "Subject and message are required." };
  const { data: r } = await supabase.from("estimate_requests").select("customer_id").eq("id", id).maybeSingle();
  if (!r) return { error: "Request not found." };
  const { error } = await supabase.from("email_log").insert({ customer_id: r.customer_id, to_email: email, to_name: name || null, subject, body, kind: "manual", rel_type: "estimate_request", rel_id: id });
  if (error) return { error: friendlyError(error.message) };
  revalidatePath(`/estimate-requests/${id}`);
  return { ok: `Logged as sent to ${email}. (Demo — no real e-mail goes out.)` };
}

export async function deleteEstimateRequest(form: FormData) {
  return withFlash(async () => {
    const { supabase } = await assertAccess("sales", "full");
    must(await supabase.from("estimate_requests").delete().eq("id", Number(str(form, "id"))));
    revalidatePath("/estimate-requests");
    redirect("/estimate-requests");
  });
}
