"use client";

import { useActionState, useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FormError } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { updatePayment } from "../actions";

type P = { id: number; amount: number; date: string; mode_id: number | null; transaction_id: string | null; note: string | null };

/** Edit a recorded payment (Perfex: amount, date, mode, transaction id, note). */
export function EditPaymentForm({ payment, modes, max }: { payment: P; modes: { id: number; name: string }[]; max: number }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(updatePayment, undefined);
  // Close once saved, so the page shows the updated figures
  useEffect(() => {
    if (state?.ok) setOpen(false);
  }, [state]);
  if (!open)
    return (
      <div className="space-y-2">
        {state?.ok && <p className="text-sm text-emerald-600">{state.ok}</p>}
        <Button size="sm" variant="secondary" onClick={() => setOpen(true)}><Pencil className="h-4 w-4" /> Edit payment</Button>
      </div>
    );
  return (
    <form action={action} className="space-y-3">
      <FormError message={state?.error} />
      <input type="hidden" name="id" value={payment.id} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Amount *"><input name="amount" type="number" step="0.01" min="0.01" max={max} defaultValue={payment.amount} required className="field" /></Field>
        <Field label="Date *"><input name="date" type="date" defaultValue={payment.date} required className="field" /></Field>
        <Field label="Mode">
          <select name="mode_id" defaultValue={payment.mode_id ?? ""} className="field">
            <option value="">—</option>
            {modes.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </Field>
        <Field label="Transaction / UTR no."><input name="transaction_id" defaultValue={payment.transaction_id ?? ""} className="field" /></Field>
        <Field label="Note" className="sm:col-span-2"><textarea name="note" defaultValue={payment.note ?? ""} rows={2} className="field" /></Field>
      </div>
      <div className="flex gap-2">
        <SubmitButton size="sm" pendingText="Saving…">Save changes</SubmitButton>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
      <p className="text-xs text-slate-400">The amount can be at most {max.toLocaleString("en-IN", { maximumFractionDigits: 2 })} — this payment plus what is still due on the invoice.</p>
    </form>
  );
}
