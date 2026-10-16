"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { buttonClass } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Field, FormError } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import type { Tables } from "@/lib/database.types";
import type { FormState } from "./actions";
import { todayIST } from "@/lib/dates";

type Opt = { id: number; name: string };

export function ExpenseForm({
  action,
  expense,
  categories,
  customers,
  modes,
  taxRates,
  projects = [],
  defaultCustomer,
  defaultProject,
}: {
  action: (s: FormState, f: FormData) => Promise<FormState>;
  expense?: Tables<"expenses">;
  projects?: { id: number; name: string; customer_id: number }[];
  /** pre-selected customer for a new expense (?customer=) */
  defaultCustomer?: number;
  /** pre-selected project for a new expense (?project=) */
  defaultProject?: number;
  categories: Opt[];
  customers: Opt[];
  modes: Opt[];
  taxRates: number[];
}) {
  const [state, formAction] = useActionState(action, undefined);
  const e = expense;
  const [customer, setCustomer] = useState(String(e?.customer_id ?? defaultCustomer ?? ""));
  const billed = !!e?.invoice_id;
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
            <input id="date" name="date" type="date" defaultValue={e?.date ?? todayIST()} className="field" />
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
            <select id="customer_id" name="customer_id" value={customer} onChange={(ev) => setCustomer(ev.target.value)} disabled={billed} className="field">
              <option value="">— Internal —</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          {projects.some((p) => String(p.customer_id) === customer) && (
            <Field label="Project" htmlFor="project_id" hint="Shows on the project's Expenses tab">
              <select key={customer} id="project_id" name="project_id" defaultValue={e?.project_id ?? defaultProject ?? ""} className="field">
                <option value="">— No project —</option>
                {projects.filter((p) => String(p.customer_id) === customer).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
          )}
          <div className="self-end pb-1">
            {billed && <input type="hidden" name="customer_id" value={customer} />}
            {billed && <input type="hidden" name="is_billable" value="on" />}
            <label className={`flex items-center gap-2 text-sm ${customer ? "text-slate-600" : "text-slate-400"}`}>
              <input type="checkbox" name="is_billable" defaultChecked={e?.is_billable} disabled={!customer || billed} className="h-4 w-4 rounded border-slate-300 text-brand-600" />
              Billable to the customer
            </label>
            <p className="mt-0.5 text-xs text-slate-400">
              {billed ? "Already billed — the customer can't change." : customer ? "Shows as “pending billing” on this customer's next invoice." : "Pick a customer to make it billable."}
            </p>
          </div>
          <Field label="Note" htmlFor="note" className="sm:col-span-2">
            <textarea id="note" name="note" rows={3} defaultValue={e?.note ?? ""} className="field" />
          </Field>
        </CardBody>
      </Card>
      <Card>
        <CardBody className="grid gap-4 sm:grid-cols-3">
          <Field label="Repeats" htmlFor="recurring_every" hint="Rent, hosting, subscriptions…">
            <div className="flex gap-2">
              <select id="recurring_every" name="recurring_every" defaultValue={e?.recurring_every ?? ""} className="field">
                <option value="">Doesn&apos;t repeat</option>
                {[1, 2, 3, 6, 12].map((n) => <option key={n} value={n}>Every {n}</option>)}
              </select>
              <select name="recurring_unit" defaultValue={e?.recurring_unit ?? "month"} className="field" aria-label="Repeat unit">
                <option value="week">week(s)</option>
                <option value="month">month(s)</option>
                <option value="year">year(s)</option>
              </select>
            </div>
          </Field>
          <Field label="Stop after" htmlFor="recurring_cycles" hint="Blank = until you stop it">
            <input id="recurring_cycles" name="recurring_cycles" type="number" min={1} max={120} defaultValue={e?.recurring_cycles ?? ""} placeholder="∞" className="field" />
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
