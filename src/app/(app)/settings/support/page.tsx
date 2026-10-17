import type { Metadata } from "next";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireAdmin } from "@/lib/auth";
import { saveTicketAutoclose } from "../actions";
import { PredefinedReplies } from "./predefined-replies";
import { NamedList } from "../named-list";

export const metadata: Metadata = { title: "Support settings" };

export default async function SupportSettingsPage() {
  const { supabase } = await requireAdmin();
  const [{ data: depts }, { data: services }, { data: groups }, { data: replies }, { data: cs }] = await Promise.all([
    supabase.from("ticket_departments").select("id, name").order("name"),
    supabase.from("ticket_services").select("id, name").order("name"),
    supabase.from("kb_groups").select("id, name").order("position"),
    supabase.from("predefined_replies").select("id, title, body").order("title"),
    supabase.from("company_settings").select("ticket_autoclose_hours").maybeSingle(),
  ]);
  return (
    <>
      <NamedList table="ticket_departments" title="Support departments" description="Route tickets to the right team." items={depts ?? []} />
      <NamedList table="ticket_services" title="Services" description="What a ticket is about (e.g. setup, training). Set on the ticket; filter the ticket list by it." items={services ?? []} />
      <Card>
        <CardHeader title="Auto-close tickets" description="Close tickets left “Answered” when the customer hasn't replied for a while (checked every hour). An internal note records it." />
        <CardBody>
          <form action={saveTicketAutoclose} className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
            <label className="flex items-center gap-2">
              <input type="checkbox" name="auto" defaultChecked={cs?.ticket_autoclose_hours != null} className="h-4 w-4 rounded border-slate-300 text-brand-600" />
              Close automatically after
            </label>
            <input name="hours" type="number" min={1} max={8760} defaultValue={cs?.ticket_autoclose_hours ?? 72} className="field w-24" aria-label="Hours without a customer reply" />
            <span>hours without a customer reply</span>
            <SubmitButton size="sm" variant="secondary" pendingText="…">Save</SubmitButton>
          </form>
        </CardBody>
      </Card>
      <PredefinedReplies replies={replies ?? []} />
      <NamedList table="kb_groups" title="Knowledge base categories" items={groups ?? []} />
    </>
  );
}
