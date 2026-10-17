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
import { formatDate } from "@/lib/utils";

export type RelOption = { value: string; label: string };
export type RelGroup = { label: string; options: RelOption[] };

const UNITS = [
  { value: "day", label: "Day(s)" },
  { value: "week", label: "Week(s)" },
  { value: "month", label: "Month(s)" },
  { value: "year", label: "Year(s)" },
];

export function TaskForm({
  action,
  task,
  assigneeIds,
  staff,
  relGroups,
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
  relGroups: RelGroup[];
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
  const [repeat, setRepeat] = useState(t?.recurring_every ? "custom" : "");
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
              {relGroups.filter((g) => g.options.length > 0).map((g) => (
                <optgroup key={g.label} label={g.label}>
                  {g.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </optgroup>
              ))}
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
          {rel.startsWith("project:") && (
            <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
              <input type="checkbox" name="visible_to_client" defaultChecked={t?.visible_to_client ?? true} className="h-4 w-4 rounded border-slate-300 text-brand-600" />
              Visible to the customer in the client portal (when the project shows its tasks)
            </label>
          )}
          <fieldset className="grid gap-4 rounded-xl border border-slate-200 p-4 sm:col-span-2 sm:grid-cols-3">
            <legend className="label px-1">Repeat</legend>
            <Field label="Repeat every" htmlFor="recurring_every">
              <div className="flex gap-2">
                <input
                  id="recurring_every"
                  name="recurring_every"
                  type="number"
                  min={1}
                  max={36}
                  placeholder="—"
                  defaultValue={t?.recurring_every ?? ""}
                  onChange={(e) => setRepeat(e.target.value ? "custom" : "")}
                  className="field w-20"
                />
                <select name="recurring_unit" aria-label="Repeat unit" defaultValue={t?.recurring_unit ?? "week"} className="field min-w-0 flex-1">
                  {UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
                </select>
              </div>
            </Field>
            <Field label="Until (optional)" htmlFor="recurring_until">
              <input id="recurring_until" name="recurring_until" type="date" defaultValue={t?.recurring_until ?? ""} disabled={!repeat} className="field" />
            </Field>
            <p className="self-end text-xs text-slate-500">
              {repeat
                ? t?.next_recurring_date
                  ? `Next copy on ${formatDate(t.next_recurring_date)}. Each copy keeps the assignees, followers and a fresh checklist.`
                  : "A fresh copy is created on each repeat, with the same assignees, followers and checklist."
                : "Leave empty for a one-off task."}
            </p>
          </fieldset>
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
