"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logActivity } from "@/lib/activity";
import { assertAccess } from "@/lib/auth";
import { str } from "@/lib/utils";

const STATUSES = ["new", "in_review", "quoted", "declined"];

export async function updateEstimateRequest(form: FormData) {
  const { supabase } = await assertAccess("sales", "edit");
  const id = Number(str(form, "id"));
  const status = str(form, "status");
  await supabase
    .from("estimate_requests")
    .update({ ...(status && STATUSES.includes(status) ? { status } : {}), assigned_to: str(form, "assigned_to") })
    .eq("id", id);
  revalidatePath(`/estimate-requests/${id}`);
  revalidatePath("/estimate-requests");
}

/** Turn the request into a lead (once), then jump to a new proposal for it. */
export async function requestToProposal(form: FormData) {
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
  await supabase.from("estimate_requests").update({ lead_id: leadId, status: r.status === "new" ? "in_review" : r.status }).eq("id", id);
  revalidatePath("/estimate-requests");
  if (str(form, "then") === "lead") redirect(`/leads/${leadId}`);
  redirect(`/sales/proposals/new?lead=${leadId}`);
}

export async function deleteEstimateRequest(form: FormData) {
  const { supabase } = await assertAccess("sales", "full");
  await supabase.from("estimate_requests").delete().eq("id", Number(str(form, "id")));
  revalidatePath("/estimate-requests");
  redirect("/estimate-requests");
}
