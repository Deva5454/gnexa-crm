"use client";

import { useActionState, useEffect, useRef } from "react";
import { Field, FormError } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { saveItem } from "../actions";

export type ItemRow = { id: number; name: string; description: string | null; rate: number; unit: string | null; tax_id: number | null };

export function ItemForm({ item, taxes, onDone }: { item?: ItemRow; taxes: { id: number; name: string }[]; onDone?: () => void }) {
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
      <Field label="Rate *"><input name="rate" type="number" min="0" step="0.01" required defaultValue={item?.rate ?? ""} className="field" /></Field>
      <Field label="Unit"><input name="unit" placeholder="nos / hrs / month" defaultValue={item?.unit ?? ""} className="field" /></Field>
      <Field label="Tax" className="sm:col-span-2">
        <select name="tax_id" defaultValue={item?.tax_id ?? ""} className="field">
          <option value="">No tax</option>
          {taxes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </Field>
      <Field label="Description" className="sm:col-span-5"><input name="description" defaultValue={item?.description ?? ""} className="field" /></Field>
      <div className="flex items-end sm:col-span-1">
        <SubmitButton className="w-full" pendingText="Saving…">{item ? "Save" : "Add item"}</SubmitButton>
      </div>
    </form>
  );
}
