import type { Metadata } from "next";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { requireAdmin } from "@/lib/auth";
import { addStatus, deleteNamed, updateStatus } from "../actions";
import { NamedList } from "../named-list";

export const metadata: Metadata = { title: "Lead pipeline" };

export default async function LeadSettingsPage() {
  const { supabase } = await requireAdmin();
  const [{ data: statuses }, { data: sources }] = await Promise.all([
    supabase.from("lead_statuses").select("*").order("sort_order"),
    supabase.from("lead_sources").select("id, name").order("name"),
  ]);
  return (
    <>
      <Card>
        <CardHeader title="Pipeline stages" description="Columns on the leads board. Mark one stage as “won” — converted leads move there." />
        <ul className="divide-y divide-slate-100">
          {statuses?.map((s) => (
            <li key={s.id} className="flex items-center gap-2 px-5 py-2.5">
              <form action={updateStatus} className="flex flex-1 flex-wrap items-center gap-2">
                <input type="hidden" name="id" value={s.id} />
                <input type="color" name="color" defaultValue={s.color} className="h-9 w-10 cursor-pointer rounded-lg border border-slate-200 bg-white p-1" aria-label="Colour" />
                <input name="name" defaultValue={s.name} required className="field max-w-[220px]" aria-label="Name" />
                <input name="sort_order" type="number" defaultValue={s.sort_order} className="field w-20" aria-label="Order" />
                <label className="flex items-center gap-1.5 text-xs text-slate-600">
                  <input type="checkbox" name="is_won" defaultChecked={s.is_won} className="h-4 w-4 rounded border-slate-300 text-brand-600" /> Won
                </label>
                <Button size="sm" variant="secondary">Save</Button>
              </form>
              <ConfirmForm action={deleteNamed} message={`Delete stage “${s.name}”? Leads in it become stage-less.`}>
                <input type="hidden" name="table" value="lead_statuses" />
                <input type="hidden" name="id" value={s.id} />
                <button className="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label={`Delete ${s.name}`}><Trash2 className="h-4 w-4" /></button>
              </ConfirmForm>
            </li>
          ))}
        </ul>
        <form action={addStatus} className="flex flex-wrap items-center gap-2 border-t border-slate-100 p-4">
          <input type="color" name="color" defaultValue="#6d55f2" className="h-9 w-10 cursor-pointer rounded-lg border border-slate-200 bg-white p-1" aria-label="Colour" />
          <input name="name" required placeholder="New stage name" className="field max-w-[220px]" />
          <label className="flex items-center gap-1.5 text-xs text-slate-600">
            <input type="checkbox" name="is_won" className="h-4 w-4 rounded border-slate-300 text-brand-600" /> Won
          </label>
          <Button variant="secondary" size="sm"><Plus className="h-4 w-4" /> Add stage</Button>
        </form>
      </Card>
      <NamedList table="lead_sources" title="Lead sources" description="Where your leads come from." items={sources ?? []} />
    </>
  );
}
