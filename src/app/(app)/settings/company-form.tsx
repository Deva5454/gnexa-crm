"use client";

import { useActionState } from "react";
import { Field, FormError } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { updateCompany } from "./actions";

export function CompanyForm({ name, currency }: { name: string; currency: string }) {
  const [state, action] = useActionState(updateCompany, undefined);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2 sm:col-span-2">
        <FormError message={state?.error} />
        {state?.ok && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{state.ok}</div>}
      </div>
      <Field label="Company name" htmlFor="company_name"><input id="company_name" name="company_name" defaultValue={name} required className="field" /></Field>
      <Field label="Default currency" htmlFor="currency" hint="ISO code, e.g. INR, USD, EUR"><input id="currency" name="currency" defaultValue={currency} maxLength={3} required className="field uppercase" /></Field>
      <div className="flex justify-end sm:col-span-2"><SubmitButton pendingText="Saving…">Save settings</SubmitButton></div>
    </form>
  );
}
