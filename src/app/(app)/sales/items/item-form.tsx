"use client";

import { useActionState, useEffect, useRef } from "react";
import { Field, FormError } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { saveItem } from "../actions";

export type ItemRow = {
  id: number;
  name: string;
  description: string | null;
  rate: number;
  unit: string | null;
  tax_id: number | null;
  hsn_sac: string | null;
  group_id: number | null;
  currency_rates: Record<string, number>;
};

export function ItemForm({
  item,
  taxes,
  groups,
  currencies,
  base,
  onDone,
}: {
  item?: ItemRow;
  taxes: { id: number; name: string }[];
  groups: { id: number; name: string }[];
  /** Currencies other than the base one: an optional fixed price for each */
  currencies: string[];
  base: string;
  onDone?: () => void;
}) {
  const [state, action] = useActionState(saveItem, undefined);
  const ref = useRef<HTMLFormElement>(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  useEffect(() => {
    if (state?.ok) {
      if (!item) ref.current?.reset();
      doneRef.current?.();
    }
  }, [state, item]);
  return (
    <form ref={ref} action={action} className="grid gap-3 sm:grid-cols-6">
      <div className="sm:col-span-6"><FormError message={state?.error} /></div>
      {item && <input type="hidden" name="id" value={item.id} />}
      <Field label="Name *" className="sm:col-span-2"><input name="name" required defaultValue={item?.name} className="field" /></Field>
      <Field label={`Rate (${base}) *`}><input name="rate" type="number" min="0" step="0.01" required defaultValue={item?.rate ?? ""} className="field" /></Field>
      <Field label="Unit"><input name="unit" placeholder="nos / hrs / month" defaultValue={item?.unit ?? ""} className="field" /></Field>
      <Field label="Tax" className="sm:col-span-2">
        <select name="tax_id" defaultValue={item?.tax_id ?? ""} className="field">
          <option value="">No tax</option>
          {taxes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </Field>
      <Field label="Description" className="sm:col-span-3"><input name="description" defaultValue={item?.description ?? ""} className="field" /></Field>
      <Field label="Group">
        <select name="group_id" defaultValue={item?.group_id ?? ""} className="field">
          <option value="">— None —</option>
          {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </Field>
      <Field label="HSN / SAC"><input name="hsn_sac" inputMode="numeric" pattern="[0-9]{4,8}" title="4 to 8 digits" placeholder="998314" defaultValue={item?.hsn_sac ?? ""} className="field" /></Field>
      <div className="flex items-end sm:col-span-1">
        <SubmitButton className="w-full" pendingText="Saving…">{item ? "Save" : "Add item"}</SubmitButton>
      </div>
      {currencies.length > 0 && (
        <fieldset className="flex flex-wrap items-end gap-3 sm:col-span-6">
          <legend className="mb-1 text-xs text-slate-500">Fixed price in other currencies — leave blank to convert from the {base} rate</legend>
          {currencies.map((c) => (
            <label key={c} className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
              {c}
              <input name={`rate_${c}`} type="number" min="0" step="0.01" defaultValue={item?.currency_rates[c] ?? ""} placeholder="auto" className="field h-8 w-28 py-0 text-sm" aria-label={`Price in ${c}`} />
            </label>
          ))}
        </fieldset>
      )}
    </form>
  );
}
