"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { buttonClass } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Field, FormError } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import type { Tables } from "@/lib/database.types";
import type { FormState } from "./actions";
import { daysFromToday, todayIST } from "@/lib/dates";

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
  projects,
  templates,
  defaultCustomer,
  defaultProject,
  cancelHref,
}: {
  action: (s: FormState, f: FormData) => Promise<FormState>;
  contract?: Tables<"contracts">;
  customers: { id: number; company: string }[];
  types: { id: number; name: string }[];
  projects: { id: number; name: string; customer_id: number }[];
  templates: { id: number; name: string; content: string }[];
  defaultCustomer?: number;
  defaultProject?: number;
  cancelHref: string;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const c = contract;
  const today = todayIST();
  const nextYear = daysFromToday(364);
  const [customer, setCustomer] = useState<number | "">(c?.customer_id ?? defaultCustomer ?? "");
  const theirProjects = projects.filter((p) => p.customer_id === customer);
  const terms = useRef<HTMLTextAreaElement>(null);
  const applyTemplate = (id: string) => {
    const t = templates.find((x) => String(x.id) === id);
    const el = terms.current;
    if (!t || !el) return;
    if (el.value.trim() && !window.confirm(`Replace the current terms with “${t.name}”?`)) return;
    el.value = t.content;
    el.focus();
  };
  return (
    <form action={formAction} className="space-y-6">
      <FormError message={state?.error} />
      <Card>
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Subject *" htmlFor="subject" className="sm:col-span-2"><input id="subject" name="subject" required defaultValue={c?.subject} placeholder="e.g. AMC — FY 2026-27" className="field" /></Field>
          <Field label="Customer *" htmlFor="customer_id">
            <select id="customer_id" name="customer_id" required value={customer} onChange={(e) => setCustomer(Number(e.target.value) || "")} className="field">
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
          <Field label="Project" htmlFor="project_id" hint={customer ? undefined : "Pick a customer first"}>
            <select key={`p${customer}`} id="project_id" name="project_id" defaultValue={theirProjects.some((p) => p.id === (c?.project_id ?? defaultProject)) ? (c?.project_id ?? defaultProject) : ""} disabled={!theirProjects.length} className="field">
              <option value="">—</option>
              {theirProjects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
            <input type="checkbox" name="visible_to_client" defaultChecked={c?.visible_to_client ?? true} className="h-4 w-4 rounded border-slate-300 text-brand-600" />
            Show this contract to the customer in the client portal
          </label>
          <div className="flex flex-wrap items-end justify-between gap-2 sm:col-span-2">
            <label htmlFor="content" className="label mb-0">Terms</label>
            {templates.length > 0 && (
              <select value="" onChange={(e) => applyTemplate(e.target.value)} aria-label="Start from a template" className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-600">
                <option value="">Start from a template…</option>
                {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            )}
          </div>
          <div className="sm:col-span-2">
            <textarea ref={terms} id="content" name="content" rows={14} defaultValue={c ? (c.content ?? "") : TEMPLATE} className="field font-mono text-xs leading-relaxed" />
          </div>
        </CardBody>
      </Card>
      <div className="flex justify-end gap-2">
        <Link href={cancelHref} className={buttonClass({ variant: "secondary" })}>Cancel</Link>
        <SubmitButton pendingText="Saving…">{c ? "Save changes" : "Create draft"}</SubmitButton>
      </div>
    </form>
  );
}
