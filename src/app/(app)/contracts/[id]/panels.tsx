"use client";

import { useActionState, useEffect, useRef } from "react";
import { Send } from "lucide-react";
import { Field, FormError } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { addContractComment, renewContract } from "../actions";

/** Perfex "Renew contract": new start, end and value; optionally ask the customer to sign again. */
export function RenewForm({ id, start, end, value, signed }: { id: number; start: string; end: string; value: number | null; signed: boolean }) {
  const [state, action] = useActionState(renewContract, undefined);
  return (
    <form action={action} className="space-y-3">
      <FormError message={state?.error} />
      {state?.ok && <p className="text-sm text-emerald-600" role="status">{state.ok}</p>}
      <input type="hidden" name="id" value={id} />
      <div className="grid grid-cols-2 gap-2">
        <Field label="New start"><input name="start_date" type="date" required defaultValue={start} className="field" /></Field>
        <Field label="New end"><input name="end_date" type="date" defaultValue={end} className="field" /></Field>
      </div>
      <Field label="New value"><input name="value" type="number" min="0" step="0.01" defaultValue={value ?? ""} className="field" /></Field>
      {signed && (
        <label className="flex items-start gap-2 text-xs text-slate-600">
          <input type="checkbox" name="keep_signature" defaultChecked className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600" />
          Keep the customer’s signature (untick to send it for signing again)
        </label>
      )}
      <SubmitButton size="sm" variant="accent" className="w-full" pendingText="Renewing…">Renew contract</SubmitButton>
    </form>
  );
}

export function ContractCommentForm({ id }: { id: number }) {
  const [state, action] = useActionState(addContractComment, undefined);
  const body = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (state?.ok && body.current) body.current.value = "";
  }, [state]);
  return (
    <form action={action} className="space-y-2">
      <FormError message={state?.error} />
      <input type="hidden" name="contract_id" value={id} />
      <textarea ref={body} name="body" rows={2} maxLength={4000} required placeholder="Reply to the customer…" aria-label="Comment" className="field text-sm" />
      <SubmitButton size="sm" variant="secondary" pendingText="Posting…"><Send className="h-3.5 w-3.5" /> Post</SubmitButton>
    </form>
  );
}
