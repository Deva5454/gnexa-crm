import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { requireStaff } from "@/lib/auth";
import { updateLead } from "../../actions";
import { leadFormOptions } from "../../form-data";
import { LeadForm } from "../../lead-form";

export const metadata: Metadata = { title: "Edit lead" };

export default async function EditLeadPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const { supabase, profile } = await requireStaff();
  const [{ data: lead }, opts] = await Promise.all([
    supabase.from("leads").select("*").eq("id", id).maybeSingle(),
    leadFormOptions(supabase),
  ]);
  if (!lead) notFound();
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={`Edit ${lead.name}`} />
      <LeadForm action={updateLead.bind(null, id)} lead={lead} {...opts} currentUserId={profile.id} cancelHref={`/leads/${id}`} />
    </div>
  );
}
