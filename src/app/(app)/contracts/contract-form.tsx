"use client";

import Link from "next/link";
import { useActionState } from "react";
import { buttonClass } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Field, FormError } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import type { Tables } from "@/lib/database.types";
import type { FormState } from "./actions";

const TEMPLATE = `1. Scope
The provider will deliver the services described in the attached schedule.

2. Term
This agreement runs from the start date to the end date unless renewed in writing.

3. Fees
Fees are payable within 15 days of invoice. GST is charged as applicable.

4. Confidentiality
Each party keeps the other's confidential information private.

5. Termination
Either party may terminate with 30 days' written notice.`;

export function ContractForm({
  action,
  contract,
  customers,
  types,
  defaultCustomer,
  cancelHref,
}: {
  action: (s: FormState, f: FormData) => Promise<FormState>;
  contract?: Tables<"contracts">;
  customers: { id: number; company: string }[];
  types: { id: number; name: string }[];
  defaultCustomer?: number;
  cancelHref: string;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const c = contract;
  const today = new Date().toISOString().slice(0, 10);
  const nextYear = new Date(Date.now() + 364 * 86400_000).toISOString().slice(0, 10);
  return (
    <form action={formAction} className="space-y-6">
      <FormError message={state?.error} />
      <Card>
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Subject *" htmlFor="subject" className="sm:col-span-2"><input id="subject" name="subject" required defaultValue={c?.subject} placeholder="e.g. AMC — FY 2026-27" className="field" /></Field>
          <Field label="Customer *" htmlFor="customer_id">
            <select id="customer_id" name="customer_id" required defaultValue={c?.customer_id ?? defaultCustomer ?? ""} className="field">
              <option value="">— Select —</option>
              {customers.map((x) => <option key={x.id} value={x.id}>{x.company}</option>)}
            </select>
          </Field>
          <Field label="Contract type" htmlFor="type_id">
            <select id="type_id" name="type_id" defaultValue={c?.type_id ?? ""} className="field">
              <option value="">—</option>
              {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </Field>
          <Field label="Start date" htmlFor="start_date"><input id="start_date" name="start_date" type="date" defaultValue={c?.start_date ?? today} className="field" /></Field>
          <Field label="End date" htmlFor="end_date" hint="Leave blank for open-ended agreements"><input id="end_date" name="end_date" type="date" defaultValue={c ? (c.end_date ?? "") : nextYear} className="field" /></Field>
          <Field label="Contract value" htmlFor="value"><input id="value" name="value" type="number" min="0" step="0.01" defaultValue={c?.value ?? ""} className="field" /></Field>
          <div />
          <Field label="Terms" htmlFor="content" className="sm:col-span-2">
            <textarea id="content" name="content" rows={14} defaultValue={c ? (c.content ?? "") : TEMPLATE} className="field font-mono text-xs leading-relaxed" />
          </Field>
        </CardBody>
      </Card>
      <div className="flex justify-end gap-2">
        <Link href={cancelHref} className={buttonClass({ variant: "secondary" })}>Cancel</Link>
        <SubmitButton pendingText="Saving…">{c ? "Save changes" : "Create draft"}</SubmitButton>
      </div>
    </form>
  );
}
