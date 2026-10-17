"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Plus, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FormError } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { applyCredit, recordPayment, recordRefund } from "../../actions";
import { todayIST } from "@/lib/dates";

/** Reset the form (and run `done`) once per successful submit. */
function useResetOnOk(state: { ok?: string } | undefined, done: () => void) {
  const ref = useRef<HTMLFormElement>(null);
  const doneRef = useRef(done);
  doneRef.current = done;
  useEffect(() => {
    if (state?.ok) {
      ref.current?.reset();
      doneRef.current();
    }
  }, [state]);
  return ref;
}

export function PaymentForm({ invoiceId, balance, modes }: { invoiceId: number; balance: number; modes: { id: number; name: string; is_default?: boolean }[] }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(recordPayment, undefined);
  const ref = useResetOnOk(state, () => setOpen(false));
  const today = todayIST();

  if (!open)
    return (
      <div className="space-y-2">
        {state?.ok && <p className="text-sm text-emerald-600">{state.ok}</p>}
        <Button size="sm" className="w-full" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Record payment
        </Button>
      </div>
    );
  return (
    <form ref={ref} action={action} className="space-y-3 rounded-xl border border-brand-100 bg-brand-50/40 p-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">Record payment</h4>
        <button type="button" onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-700" aria-label="Close">
          <X className="h-4 w-4" />
        </button>
      </div>
      <FormError message={state?.error} />
      <input type="hidden" name="invoice_id" value={invoiceId} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount *"><input name="amount" type="number" step="0.01" min="0.01" max={balance} defaultValue={balance.toFixed(2)} required className="field" /></Field>
        <Field label="Date"><input name="date" type="date" defaultValue={today} className="field" /></Field>
        <Field label="Mode" className="col-span-2">
          <select name="mode_id" className="field" defaultValue={(modes.find((m) => m.is_default) ?? modes[0])?.id ?? ""}>
            {modes.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </Field>
        <Field label="Transaction / UTR no." className="col-span-2"><input name="transaction_id" className="field" /></Field>
        <Field label="Note" className="col-span-2"><input name="note" className="field" /></Field>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input type="checkbox" name="send_receipt" defaultChecked className="h-4 w-4 rounded border-slate-300 text-brand-600" />
        E-mail a receipt to the customer
      </label>
      <SubmitButton size="sm" className="w-full" pendingText="Saving…">Save payment</SubmitButton>
    </form>
  );
}

export function ApplyCreditForm({
  creditNoteId,
  available,
  invoices,
}: {
  creditNoteId: number;
  available: number;
  invoices: { id: number; label: string; balance: number }[];
}) {
  const [state, action] = useActionState(applyCredit, undefined);
  const [inv, setInv] = useState(invoices[0]?.id ?? 0);
  const ref = useResetOnOk(state, () => {});
  const due = invoices.find((i) => i.id === inv)?.balance ?? 0;
  if (!invoices.length) return <p className="text-sm text-slate-400">No open invoices for this customer.</p>;
  return (
    <form ref={ref} action={action} className="space-y-3">
      <FormError message={state?.error} />
      {state?.ok && <p className="text-sm text-emerald-600">{state.ok}</p>}
      <input type="hidden" name="credit_note_id" value={creditNoteId} />
      <Field label="Invoice">
        <select name="invoice_id" value={inv} onChange={(e) => setInv(Number(e.target.value))} className="field">
          {invoices.map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
        </select>
      </Field>
      <Field label="Amount">
        <input key={inv} name="amount" type="number" step="0.01" min="0.01" defaultValue={Math.min(available, due).toFixed(2)} className="field" />
      </Field>
      <SubmitButton size="sm" className="w-full" pendingText="Applying…">Apply credit</SubmitButton>
    </form>
  );
}

/** Invoice side of credits (Perfex "Apply credits"): pick one of the customer's open credit notes. */
export function InvoiceCreditForm({
  invoiceId,
  due,
  credits,
}: {
  invoiceId: number;
  due: number;
  credits: { id: number; label: string; available: number }[];
}) {
  const [state, action] = useActionState(applyCredit, undefined);
  const [cn, setCn] = useState(credits[0]?.id ?? 0);
  const ref = useResetOnOk(state, () => {});
  const available = credits.find((c) => c.id === cn)?.available ?? 0;
  return (
    <form ref={ref} action={action} className="space-y-3">
      <FormError message={state?.error} />
      {state?.ok && <p className="text-sm text-emerald-600">{state.ok}</p>}
      <input type="hidden" name="invoice_id" value={invoiceId} />
      <Field label="Credit note">
        <select name="credit_note_id" value={cn} onChange={(e) => setCn(Number(e.target.value))} className="field">
          {credits.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
      </Field>
      <Field label="Amount">
        <input key={cn} name="amount" type="number" step="0.01" min="0.01" max={Math.min(available, due)} defaultValue={Math.min(available, due).toFixed(2)} className="field" />
      </Field>
      <SubmitButton size="sm" className="w-full" pendingText="Applying…">Apply credit</SubmitButton>
    </form>
  );
}

/** Refund part or all of the credit left on a credit note. */
export function RefundForm({ creditNoteId, available, modes }: { creditNoteId: number; available: number; modes: { id: number; name: string; is_default?: boolean }[] }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(recordRefund, undefined);
  const ref = useResetOnOk(state, () => setOpen(false));
  if (!open)
    return (
      <div className="space-y-2">
        {state?.ok && <p className="text-sm text-emerald-600">{state.ok}</p>}
        <Button size="sm" variant="secondary" className="w-full" onClick={() => setOpen(true)}>
          <Undo2 className="h-4 w-4" /> Refund
        </Button>
      </div>
    );
  return (
    <form ref={ref} action={action} className="space-y-3 rounded-xl border border-violet-100 bg-violet-50/40 p-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">Refund to customer</h4>
        <button type="button" onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-700" aria-label="Close">
          <X className="h-4 w-4" />
        </button>
      </div>
      <FormError message={state?.error} />
      <input type="hidden" name="credit_note_id" value={creditNoteId} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount *"><input name="amount" type="number" step="0.01" min="0.01" max={available} defaultValue={available.toFixed(2)} required className="field" /></Field>
        <Field label="Date"><input name="date" type="date" defaultValue={todayIST()} className="field" /></Field>
        <Field label="Paid via" className="col-span-2">
          <select name="mode_id" className="field" defaultValue={(modes.find((m) => m.is_default) ?? modes[0])?.id ?? ""}>
            <option value="">—</option>
            {modes.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </Field>
        <Field label="Reference / UTR no." className="col-span-2"><input name="reference" maxLength={120} className="field" /></Field>
        <Field label="Note" className="col-span-2"><input name="note" maxLength={1000} className="field" /></Field>
      </div>
      <SubmitButton size="sm" className="w-full" pendingText="Saving…">Record refund</SubmitButton>
    </form>
  );
}
