import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { requireStaff } from "@/lib/auth";
import { createLead } from "../actions";
import { leadFormOptions } from "../form-data";
import { LeadForm } from "../lead-form";

export const metadata: Metadata = { title: "New lead" };

export default async function NewLeadPage() {
  const { supabase, profile } = await requireStaff();
  const opts = await leadFormOptions(supabase);
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="New lead" description="Capture a prospect and drop them into your pipeline." />
      <LeadForm action={createLead} {...opts} currentUserId={profile.id} cancelHref="/leads" />
    </div>
  );
}
