import type { Metadata } from "next";
import { Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { SubmitButton } from "@/components/ui/submit-button";
import { deleteCustomField, saveCustomField } from "@/lib/actions/custom-fields";
import { requireAdmin } from "@/lib/auth";
import { CF_ENTITIES, CF_TYPES } from "@/lib/custom-fields";

export const metadata: Metadata = { title: "Custom fields" };

export default async function CustomFieldsSettings() {
  const { supabase } = await requireAdmin();
  const [{ data: fields }, { data: used }] = await Promise.all([
    supabase.from("custom_fields").select("*").order("entity").order("position").order("id"),
    supabase.from("custom_field_values").select("field_id"),
  ]);
  const uses = new Map<number, number>();
  for (const u of used ?? []) uses.set(u.field_id, (uses.get(u.field_id) ?? 0) + 1);
  const typeLabel = (t: string) => CF_TYPES.find((x) => x.key === t)?.label ?? t;

  return (
    <>
      <Card>
        <CardHeader title="Add a custom field" description="Extra fields appear in a “More details” card on the record. Dropdown options: one per line or comma-separated." />
        <form action={saveCustomField} className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <select name="entity" className="field" aria-label="Applies to">{CF_ENTITIES.map((e) => <option key={e.key} value={e.key}>{e.label}</option>)}</select>
          <input name="label" required maxLength={60} placeholder="Field name, e.g. Industry" className="field" />
          <select name="type" className="field" aria-label="Type">{CF_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}</select>
          <input name="options" placeholder="Options (dropdowns only)" className="field" />
          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600 sm:col-span-2 lg:col-span-3">
            <label className="flex items-center gap-2"><input type="checkbox" name="required" className="h-4 w-4 rounded border-slate-300 text-brand-600" /> Required</label>
            <label className="flex items-center gap-2"><input type="checkbox" name="show_on_pdf" className="h-4 w-4 rounded border-slate-300 text-brand-600" /> Print on PDF (documents only)</label>
          </div>
          <SubmitButton size="sm" pendingText="Adding…"><Plus className="h-4 w-4" /> Add field</SubmitButton>
        </form>
      </Card>
      {CF_ENTITIES.map((e) => {
        const list = (fields ?? []).filter((f) => f.entity === e.key);
        return (
          <Card key={e.key}>
            <CardHeader title={e.label} description={`${list.length} field${list.length === 1 ? "" : "s"}`} />
            {!list.length ? (
              <p className="px-5 py-4 text-sm text-slate-400">No custom fields.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {list.map((f) => (
                  <li key={f.id} className="px-5 py-3">
                    <form action={saveCustomField} className="flex flex-wrap items-center gap-3 text-sm">
                      <input type="hidden" name="id" value={f.id} />
                      <input name="label" defaultValue={f.label} required maxLength={60} className="field max-w-[14rem]" aria-label="Field name" />
                      <Badge>{typeLabel(f.type)}</Badge>
                      {f.type === "select" && <input name="options" defaultValue={f.options.join(", ")} className="field max-w-[18rem]" aria-label="Options" />}
                      <label className="flex items-center gap-1.5 text-slate-600"><input type="checkbox" name="required" defaultChecked={f.required} className="h-4 w-4 rounded border-slate-300 text-brand-600" /> Required</label>
                      {e.key === "sales_doc" && <label className="flex items-center gap-1.5 text-slate-600"><input type="checkbox" name="show_on_pdf" defaultChecked={f.show_on_pdf} className="h-4 w-4 rounded border-slate-300 text-brand-600" /> On PDF</label>}
                      <label className="flex items-center gap-1.5 text-slate-600"><input type="checkbox" name="is_active" defaultChecked={f.is_active} className="h-4 w-4 rounded border-slate-300 text-brand-600" /> Active</label>
                      <span className="text-xs text-slate-400">{uses.get(f.id) ?? 0} filled</span>
                      <SubmitButton size="sm" variant="secondary" pendingText="…">Save</SubmitButton>
                    </form>
                    <ConfirmForm action={deleteCustomField} message={`Delete “${f.label}” and its ${uses.get(f.id) ?? 0} saved value(s)?`} className="mt-1">
                      <input type="hidden" name="id" value={f.id} />
                      <button className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-rose-600"><Trash2 className="h-3.5 w-3.5" /> Delete field</button>
                    </ConfirmForm>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        );
      })}
    </>
  );
}
