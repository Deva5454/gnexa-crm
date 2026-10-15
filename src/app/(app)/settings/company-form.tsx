"use client";

import { useActionState } from "react";
import { Field, FormError } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import type { Tables } from "@/lib/database.types";
import { updateCompany } from "./actions";

export function CompanyForm({ settings }: { settings: Tables<"company_settings"> | null }) {
  const [state, action] = useActionState(updateCompany, undefined);
  const s = settings;
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2 sm:col-span-2">
        <FormError message={state?.error} />
        {state?.ok && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{state.ok}</div>}
      </div>
      <Field label="Company name" htmlFor="company_name"><input id="company_name" name="company_name" defaultValue={s?.company_name ?? "Gnexa"} required className="field" /></Field>
      <Field label="Default currency" htmlFor="currency" hint="ISO code, e.g. INR, USD, EUR"><input id="currency" name="currency" defaultValue={s?.currency ?? "INR"} maxLength={3} required className="field uppercase" /></Field>
      <Field label="GSTIN" htmlFor="gstin"><input id="gstin" name="gstin" defaultValue={s?.gstin ?? ""} maxLength={15} className="field uppercase" /></Field>
      <Field label="Phone" htmlFor="phone"><input id="phone" name="phone" defaultValue={s?.phone ?? ""} className="field" /></Field>
      <Field label="Billing email" htmlFor="email" className="sm:col-span-2"><input id="email" name="email" type="email" defaultValue={s?.email ?? ""} className="field" /></Field>
      <Field label="Address (printed on documents)" htmlFor="address"><textarea id="address" name="address" rows={3} defaultValue={s?.address ?? ""} className="field" /></Field>
      <Field label="Bank / payment details (printed on invoices)" htmlFor="bank_details"><textarea id="bank_details" name="bank_details" rows={3} defaultValue={s?.bank_details ?? ""} className="field" /></Field>
      <Field label="Default invoice terms" htmlFor="default_terms" className="sm:col-span-2"><textarea id="default_terms" name="default_terms" rows={2} defaultValue={s?.default_terms ?? ""} className="field" /></Field>
      <div className="flex justify-end sm:col-span-2"><SubmitButton pendingText="Saving…">Save settings</SubmitButton></div>
    </form>
  );
}
