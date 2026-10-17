import type { Metadata } from "next";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireAdmin } from "@/lib/auth";
import { Plus, Trash2 } from "lucide-react";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { deleteNamed, saveKbGroup, saveKbPublic, saveTicketAutoclose } from "../actions";
import { PredefinedReplies } from "./predefined-replies";
import { NamedList } from "../named-list";

export const metadata: Metadata = { title: "Support settings" };

export default async function SupportSettingsPage() {
  const { supabase } = await requireAdmin();
  const [{ data: depts }, { data: services }, { data: groups }, { data: replies }, { data: cs }] = await Promise.all([
    supabase.from("ticket_departments").select("id, name").order("name"),
    supabase.from("ticket_services").select("id, name").order("name"),
    supabase.from("kb_groups").select("id, name, description, color, position, is_active").order("position").order("name"),
    supabase.from("predefined_replies").select("id, title, body").order("title"),
    supabase.from("company_settings").select("ticket_autoclose_hours, kb_public").maybeSingle(),
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
      <Card>
        <CardHeader title="Knowledge base groups" description="Categories for help articles. A switched-off group and its articles disappear from the client portal and public help center (staff still see them)." />
        <ul className="divide-y divide-slate-100">
          {(groups ?? []).map((g) => (
            <li key={g.id} className="flex flex-wrap items-center gap-2 px-5 py-3">
              <form action={saveKbGroup} className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                <input type="hidden" name="id" value={g.id} />
                <input type="color" name="color" defaultValue={g.color} aria-label={`Colour for ${g.name}`} className="h-8 w-9 cursor-pointer rounded border border-slate-200 bg-white p-0.5" />
                <input name="name" defaultValue={g.name} required maxLength={120} aria-label="Name" className="field h-8 w-44 py-0 text-sm" />
                <input name="description" defaultValue={g.description ?? ""} maxLength={300} placeholder="Description" aria-label="Description" className="field h-8 min-w-0 flex-1 py-0 text-sm" />
                <input name="position" type="number" defaultValue={g.position} aria-label="Order" className="field h-8 w-16 py-0 text-sm" />
                <label className="flex items-center gap-1.5 text-xs text-slate-600">
                  <input type="checkbox" name="is_active" defaultChecked={g.is_active} className="h-4 w-4 rounded border-slate-300 text-brand-600" /> Active
                </label>
                <SubmitButton size="sm" variant="secondary" pendingText="…">Save</SubmitButton>
              </form>
              <ConfirmForm action={deleteNamed} message={`Delete the group “${g.name}”? Its articles become uncategorised.`}>
                <input type="hidden" name="table" value="kb_groups" />
                <input type="hidden" name="id" value={g.id} />
                <button className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label={`Delete ${g.name}`}><Trash2 className="h-4 w-4" /></button>
              </ConfirmForm>
            </li>
          ))}
          {!groups?.length && <li className="px-5 py-4 text-sm text-slate-400">No groups yet.</li>}
        </ul>
        <form action={saveKbGroup} className="flex flex-wrap gap-2 border-t border-slate-100 p-4">
          <input type="color" name="color" defaultValue="#0d9488" aria-label="Colour" className="h-9 w-10 cursor-pointer rounded border border-slate-200 bg-white p-0.5" />
          <input name="name" required maxLength={120} placeholder="New group…" aria-label="New group name" className="field min-w-0 flex-1" />
          <SubmitButton variant="secondary" pendingText="…"><Plus className="h-4 w-4" /> Add</SubmitButton>
        </form>
      </Card>
      <Card>
        <CardHeader title="Public help center" description="Let anyone read your published, non-internal articles at /help without signing in (Perfex “public knowledge base”). Customers can always read them in the client portal." />
        <CardBody>
          <form action={saveKbPublic} className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
            <label className="flex items-center gap-2">
              <input type="checkbox" name="kb_public" defaultChecked={cs?.kb_public ?? false} className="h-4 w-4 rounded border-slate-300 text-brand-600" />
              Publish the help center at <span className="font-mono text-xs">/help</span>
            </label>
            <SubmitButton size="sm" variant="secondary" pendingText="…">Save</SubmitButton>
          </form>
        </CardBody>
      </Card>
    </>
  );
}
