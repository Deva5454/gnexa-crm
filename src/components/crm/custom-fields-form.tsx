"use client";

import { useActionState, useState } from "react";
import { Pencil } from "lucide-react";
import { SubmitButton } from "@/components/ui/submit-button";
import type { CfState } from "@/lib/actions/custom-fields";
import { displayValue, type CfField } from "@/lib/custom-fields";

export function CustomFieldsForm({
  fields,
  values,
  action,
  canEdit,
}: {
  fields: CfField[];
  values: Record<number, string>;
  action: (s: CfState, f: FormData) => Promise<CfState>;
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [state, formAction] = useActionState(async (s: CfState, f: FormData) => {
    const r = await action(s, f);
    if (r?.ok) setEditing(false);
    return r;
  }, undefined);

  if (!editing)
    return (
      <div className="space-y-3">
        <dl className="space-y-3 text-sm">
          {fields.map((f) => (
            <div key={f.id}>
              <dt className="label">{f.label}</dt>
              <dd className="whitespace-pre-wrap text-slate-700">{values[f.id] ? displayValue(f, values[f.id]!) : <span className="text-slate-400">—</span>}</dd>
            </div>
          ))}
        </dl>
        {canEdit && (
          <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-800">
            <Pencil className="h-3.5 w-3.5" /> Edit details
          </button>
        )}
        {state?.ok && <p className="text-xs text-emerald-600">{state.ok}</p>}
      </div>
    );

  return (
    <form action={formAction} className="space-y-3">
      {fields.map((f) => {
        const id = `cf_${f.id}`;
        const v = values[f.id] ?? "";
        return (
          <div key={f.id}>
            {f.type !== "checkbox" && <label htmlFor={id} className="label">{f.label}{f.required && " *"}</label>}
            {f.type === "textarea" ? (
              <textarea id={id} name={id} defaultValue={v} rows={3} required={f.required} className="field" />
            ) : f.type === "select" ? (
              <select id={id} name={id} defaultValue={v} required={f.required} className="field">
                <option value="">—</option>
                {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : f.type === "checkbox" ? (
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input id={id} name={id} type="checkbox" defaultChecked={v === "true"} className="h-4 w-4 rounded border-slate-300 text-brand-600" />
                {f.label}{f.required && " *"}
              </label>
            ) : (
              <input id={id} name={id} type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"} step="any" defaultValue={v} required={f.required} className="field" />
            )}
          </div>
        );
      })}
      {state?.error && <p className="text-xs text-rose-600">{state.error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setEditing(false)} className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100">Cancel</button>
        <SubmitButton size="sm" pendingText="Saving…">Save</SubmitButton>
      </div>
    </form>
  );
}
