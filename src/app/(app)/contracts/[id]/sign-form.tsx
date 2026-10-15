"use client";

import { useActionState } from "react";
import { Field, FormError } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { signContract } from "../actions";

export function SignForm({ id, defaultSigner }: { id: number; defaultSigner: string }) {
  const [state, action] = useActionState(signContract, undefined);
  return (
    <form action={action} className="space-y-3">
      <FormError message={state?.error} />
      <input type="hidden" name="id" value={id} />
      <Field label="Signed by"><input name="signed_by" defaultValue={defaultSigner} required className="field" /></Field>
      <Field label="Signed on"><input name="signed_on" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className="field" /></Field>
      <label className="flex items-start gap-2 text-xs text-slate-600">
        <input type="checkbox" name="confirm" className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600" />
        I have the signed copy from the customer.
      </label>
      <SubmitButton size="sm" variant="accent" className="w-full" pendingText="Saving…">Record signature</SubmitButton>
    </form>
  );
}
