"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { buttonClass } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, FormError } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { PROJECT_STATUSES } from "@/lib/constants";
import type { Tables } from "@/lib/database.types";
import type { FormState } from "./actions";

export function ProjectForm({
  action,
  project,
  memberIds,
  customers,
  staff,
  currentUserId,
  defaultCustomer,
  cancelHref,
}: {
  action: (s: FormState, f: FormData) => Promise<FormState>;
  project?: Tables<"projects">;
  memberIds?: string[];
  customers: { id: number; company: string }[];
  staff: { id: string; full_name: string }[];
  currentUserId: string;
  defaultCustomer?: number;
  cancelHref: string;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const p = project;
  const [billing, setBilling] = useState(p?.billing_type ?? "fixed");
  const members = new Set(memberIds ?? [currentUserId]);
  return (
    <form action={formAction} className="space-y-6">
      <FormError message={state?.error} />
      <Card>
        <CardHeader title="Project" />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Project name *" htmlFor="name" className="sm:col-span-2">
            <input id="name" name="name" required defaultValue={p?.name} className="field" />
          </Field>
          <Field label="Customer *" htmlFor="customer_id">
            <select id="customer_id" name="customer_id" required defaultValue={p?.customer_id ?? defaultCustomer ?? ""} className="field">
              <option value="">— Select —</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.company}</option>)}
            </select>
          </Field>
          <Field label="Status" htmlFor="status">
            <select id="status" name="status" defaultValue={p?.status ?? "not_started"} className="field">
              {PROJECT_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </Field>
          <Field label="Start date" htmlFor="start_date">
            <input id="start_date" name="start_date" type="date" defaultValue={p?.start_date ?? new Date().toISOString().slice(0, 10)} className="field" />
          </Field>
          <Field label="Deadline" htmlFor="deadline">
            <input id="deadline" name="deadline" type="date" defaultValue={p?.deadline ?? ""} className="field" />
          </Field>
          <Field label="Billing" htmlFor="billing_type">
            <select id="billing_type" name="billing_type" value={billing} onChange={(e) => setBilling(e.target.value)} className="field">
              <option value="fixed">Fixed price</option>
              <option value="hourly">Hourly — bill logged time</option>
            </select>
          </Field>
          {billing === "fixed" ? (
            <Field label="Fixed price (before tax)" htmlFor="fixed_price">
              <input id="fixed_price" name="fixed_price" type="number" min="0" step="0.01" defaultValue={p?.fixed_price ?? ""} className="field" />
            </Field>
          ) : (
            <Field label="Hourly rate *" htmlFor="hourly_rate">
              <input id="hourly_rate" name="hourly_rate" type="number" min="1" step="0.01" required defaultValue={p?.hourly_rate ?? ""} className="field" />
            </Field>
          )}
          <Field label="Description" htmlFor="description" className="sm:col-span-2">
            <textarea id="description" name="description" rows={4} defaultValue={p?.description ?? ""} className="field" />
          </Field>
          <fieldset className="sm:col-span-2">
            <legend className="label">Team</legend>
            <div className="flex flex-wrap gap-2">
              {staff.map((s) => (
                <label key={s.id} className="flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm has-[:checked]:border-brand-300 has-[:checked]:bg-brand-50 has-[:checked]:text-brand-700">
                  <input type="checkbox" name="members" value={s.id} defaultChecked={members.has(s.id)} className="h-3.5 w-3.5 rounded border-slate-300 text-brand-600" />
                  {s.full_name}
                </label>
              ))}
            </div>
          </fieldset>
        </CardBody>
      </Card>
      <div className="flex justify-end gap-2">
        <Link href={cancelHref} className={buttonClass({ variant: "secondary" })}>Cancel</Link>
        <SubmitButton pendingText="Saving…">{p ? "Save changes" : "Create project"}</SubmitButton>
      </div>
    </form>
  );
}
