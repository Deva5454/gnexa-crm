import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { requireAccess } from "@/lib/auth";
import { TicketForm } from "../ticket-form";
import { allRows } from "@/lib/fetch-all";

export const metadata: Metadata = { title: "New ticket" };

export default async function NewTicketPage({ searchParams }: { searchParams: Promise<{ customer?: string; project?: string }> }) {
  const sp = await searchParams;
  const { supabase, profile } = await requireAccess("support", "edit", "/support");
  const [{ data: customers }, { data: contacts }, { data: departments }, { data: projects }, { data: staff }] = await Promise.all([
    allRows((a, b) => supabase.from("customers").select("id, company").order("company").order("id").range(a, b)),
    supabase.from("contacts").select("id, first_name, last_name, customer_id").order("first_name"),
    supabase.from("ticket_departments").select("id, name").order("name"),
    supabase.from("projects").select("id, name, customer_id").order("name"),
    supabase.from("profiles").select("id, full_name").eq("is_active", true).order("full_name"),
  ]);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="New ticket" description="Log a customer issue or request." />
      <TicketForm
        customers={(customers ?? []).map((c) => ({ id: c.id, name: c.company }))}
        contacts={(contacts ?? []).map((c) => ({ id: c.id, name: [c.first_name, c.last_name].filter(Boolean).join(" "), customer_id: c.customer_id }))}
        departments={departments ?? []}
        projects={projects ?? []}
        staff={staff ?? []}
        defaultCustomer={Number(sp.customer) || undefined}
        defaultProject={Number(sp.project) || undefined}
        currentUserId={profile.id}
      />
    </div>
  );
}
