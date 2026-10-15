"use client";

import Link from "next/link";
import { useActionState } from "react";
import { buttonClass } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Field, FormError } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import type { Tables } from "@/lib/database.types";
import type { FormState } from "./actions";

type Opt = { id: number; name: string };

export function ExpenseForm({
  action,
  expense,
  categories,
  customers,
  modes,
  taxRates,
}: {
  action: (s: FormState, f: FormData) => Promise<FormState>;
  expense?: Tables<"expenses">;
  categories: Opt[];
  customers: Opt[];
  modes: Opt[];
  taxRates: number[];
}) {
  const [state, formAction] = useActionState(action, undefined);
  const e = expense;
  return (
    <form action={formAction} className="space-y-6">
      <FormError message={state?.error} />
      <Card>
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Expense name *" htmlFor="name" className="sm:col-span-2">
            <input id="name" name="name" required defaultValue={e?.name} placeholder="e.g. Client visit — Pune" className="field" />
          </Field>
          <Field label="Category" htmlFor="category_id">
            <select id="category_id" name="category_id" defaultValue={e?.category_id ?? categories[0]?.id ?? ""} className="field">
              <option value="">— None —</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Date" htmlFor="date">
            <input id="date" name="date" type="date" defaultValue={e?.date ?? new Date().toISOString().slice(0, 10)} className="field" />
          </Field>
          <Field label="Amount *" htmlFor="amount">
            <input id="amount" name="amount" type="number" min="0" step="0.01" required defaultValue={e?.amount ?? ""} className="field" />
          </Field>
          <Field label="Tax" htmlFor="tax_rate">
            <select id="tax_rate" name="tax_rate" defaultValue={e?.tax_rate ?? 0} className="field">
              {[0, ...taxRates].map((t) => <option key={t} value={t}>{t ? `GST ${t}%` : "No tax"}</option>)}
            </select>
          </Field>
          <Field label="Paid via" htmlFor="payment_mode_id">
            <select id="payment_mode_id" name="payment_mode_id" defaultValue={e?.payment_mode_id ?? ""} className="field">
              <option value="">—</option>
              {modes.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </Field>
          <Field label="Reference / bill no." htmlFor="reference">
            <input id="reference" name="reference" defaultValue={e?.reference ?? ""} className="field" />
          </Field>
          <Field label="Customer" htmlFor="customer_id" hint="Link to a customer to track or re-bill it">
            <select id="customer_id" name="customer_id" defaultValue={e?.customer_id ?? ""} className="field">
              <option value="">— Internal —</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-600">
            <input type="checkbox" name="is_billable" defaultChecked={e?.is_billable} className="h-4 w-4 rounded border-slate-300 text-brand-600" />
            Billable to the customer
          </label>
          <Field label="Note" htmlFor="note" className="sm:col-span-2">
            <textarea id="note" name="note" rows={3} defaultValue={e?.note ?? ""} className="field" />
          </Field>
        </CardBody>
      </Card>
      <div className="flex justify-end gap-2">
        <Link href="/expenses" className={buttonClass({ variant: "secondary" })}>Cancel</Link>
        <SubmitButton pendingText="Saving…">{e ? "Save changes" : "Add expense"}</SubmitButton>
      </div>
    </form>
  );
}
