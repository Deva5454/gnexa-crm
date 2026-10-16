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
import { todayIST } from "@/lib/dates";

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
  const [manual, setManual] = useState(p?.progress_manual != null);
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
            <input id="start_date" name="start_date" type="date" defaultValue={p?.start_date ?? todayIST()} className="field" />
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
          <Field label="Estimated hours" htmlFor="estimated_hours" hint="The time budget — compared with hours logged">
            <input id="estimated_hours" name="estimated_hours" type="number" min="0" step="0.5" defaultValue={p?.estimated_hours ?? ""} className="field" />
          </Field>
          <Field label="Progress" htmlFor="progress_mode">
            <div className="flex items-center gap-2">
              <select id="progress_mode" name="progress_mode" value={manual ? "manual" : "tasks"} onChange={(e) => setManual(e.target.value === "manual")} className="field">
                <option value="tasks">From completed tasks</option>
                <option value="manual">Set by hand</option>
              </select>
              {manual && (
                <input name="progress_manual" type="number" min="0" max="100" step="5" defaultValue={p?.progress_manual ?? 0} aria-label="Progress %" className="field w-24" />
              )}
            </div>
          </Field>
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
      <Card>
        <CardHeader title="Customer portal" description="What the customer sees of this project when they sign in to the portal" />
        <CardBody className="space-y-2 text-sm text-slate-700">
          {[
            ["portal_visible", "Show this project in the customer portal", p?.portal_visible ?? true],
            ["portal_show_tasks", "Show its tasks and milestones progress", p?.portal_show_tasks ?? true],
            ["portal_show_timesheets", "Show its timesheets (hours logged)", p?.portal_show_timesheets ?? false],
          ].map(([name, label, on]) => (
            <label key={name as string} className="flex items-center gap-2">
              <input type="checkbox" name={name as string} defaultChecked={on as boolean} className="h-4 w-4 rounded border-slate-300 text-brand-600" />
              {label as string}
            </label>
          ))}
        </CardBody>
      </Card>
      <div className="flex justify-end gap-2">
        <Link href={cancelHref} className={buttonClass({ variant: "secondary" })}>Cancel</Link>
        <SubmitButton pendingText="Saving…">{p ? "Save changes" : "Create project"}</SubmitButton>
      </div>
    </form>
  );
}
