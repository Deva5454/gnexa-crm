"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Field, FormError } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/lib/constants";
import type { Tables } from "@/lib/database.types";
import type { FormState } from "./actions";
import { todayIST } from "@/lib/dates";

export type RelOption = { value: string; label: string };

export function TaskForm({
  action,
  task,
  assigneeIds,
  staff,
  customers,
  leads,
  projects,
  milestones,
  defaultRel,
  defaultMilestone,
  defaultAssignee,
  cancelHref,
}: {
  action: (s: FormState, f: FormData) => Promise<FormState>;
  task?: Tables<"tasks">;
  assigneeIds?: string[];
  staff: Pick<Tables<"profiles">, "id" | "full_name">[];
  customers: RelOption[];
  leads: RelOption[];
  projects: RelOption[];
  milestones: { id: number; name: string; project: string }[];
  defaultRel?: string;
  defaultMilestone?: number;
  defaultAssignee?: string;
  cancelHref: string;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const t = task;
  const initialRel = t?.rel_type && t.rel_id ? `${t.rel_type}:${t.rel_id}` : (defaultRel ?? "");
  const [rel, setRel] = useState(initialRel);
  const projectMilestones = milestones.filter((m) => m.project === rel);
  const assigned = new Set(assigneeIds ?? (defaultAssignee ? [defaultAssignee] : []));
  const today = todayIST();

  return (
    <form action={formAction} className="space-y-6">
      <FormError message={state?.error} />
      {state && !state.error && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          <CheckCircle2 className="h-4 w-4" /> Saved
        </div>
      )}
      <Card>
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Subject *" htmlFor="name" className="sm:col-span-2">
            <input id="name" name="name" required defaultValue={t?.name} className="field text-base font-medium" />
          </Field>
          <Field label="Status" htmlFor="status">
            <select id="status" name="status" defaultValue={t?.status ?? "not_started"} className="field">
              {TASK_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </Field>
          <Field label="Priority" htmlFor="priority">
            <select id="priority" name="priority" defaultValue={t?.priority ?? "medium"} className="field">
              {TASK_PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </Field>
          <Field label="Start date" htmlFor="start_date">
            <input id="start_date" name="start_date" type="date" defaultValue={t ? (t.start_date ?? "") : today} className="field" />
          </Field>
          <Field label="Due date" htmlFor="due_date">
            <input id="due_date" name="due_date" type="date" defaultValue={t?.due_date ?? ""} className="field" />
          </Field>
          <Field label="Related to" htmlFor="rel" className="sm:col-span-2">
            <select id="rel" name="rel" value={rel} onChange={(e) => setRel(e.target.value)} className="field">
              <option value="">— Nothing —</option>
              {customers.length > 0 && (
                <optgroup label="Customers">
                  {customers.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </optgroup>
              )}
              {leads.length > 0 && (
                <optgroup label="Leads">
                  {leads.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                </optgroup>
              )}
              {projects.length > 0 && (
                <optgroup label="Projects">
                  {projects.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </optgroup>
              )}
            </select>
          </Field>
          {projectMilestones.length > 0 && (
            <Field label="Milestone" htmlFor="milestone_id" className="sm:col-span-2">
              <select id="milestone_id" name="milestone_id" defaultValue={t?.milestone_id ?? defaultMilestone ?? ""} className="field">
                <option value="">— No milestone —</option>
                {projectMilestones.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </Field>
          )}
          <Field label="Description" htmlFor="description" className="sm:col-span-2">
            <textarea id="description" name="description" rows={5} defaultValue={t?.description ?? ""} className="field" />
          </Field>
          <fieldset className="sm:col-span-2">
            <legend className="label">Assignees</legend>
            <div className="flex flex-wrap gap-2">
              {staff.map((s) => (
                <label key={s.id} className="flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm has-[:checked]:border-brand-300 has-[:checked]:bg-brand-50 has-[:checked]:text-brand-700">
                  <input type="checkbox" name="assignees" value={s.id} defaultChecked={assigned.has(s.id)} className="h-3.5 w-3.5 rounded border-slate-300 text-brand-600" />
                  {s.full_name}
                </label>
              ))}
            </div>
          </fieldset>
        </CardBody>
      </Card>
      <div className="flex justify-end gap-2">
        <Link href={cancelHref} className={buttonClass({ variant: "secondary" })}>{t ? "Back" : "Cancel"}</Link>
        <SubmitButton pendingText="Saving…">{t ? "Save task" : "Create task"}</SubmitButton>
      </div>
    </form>
  );
}
