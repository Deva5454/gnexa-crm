"use client";

import { useActionState, useEffect, useRef } from "react";
import { Field, FormError } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { GOAL_METRICS } from "@/lib/goals";
import { addGoal } from "./actions";

export function GoalForm({ staff }: { staff: { id: string; full_name: string }[] }) {
  const [state, action] = useActionState(addGoal, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  const now = new Date();
  const ms = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const me = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  return (
    <form ref={ref} action={action} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
      <div className="lg:col-span-6"><FormError message={state?.error} />{state?.ok && <p className="text-sm text-emerald-600">{state.ok}</p>}</div>
      <Field label="Goal" className="lg:col-span-2"><input name="title" required placeholder="e.g. Collect ₹10 lakh in November" className="field" /></Field>
      <Field label="Measure">
        <select name="metric" className="field">{GOAL_METRICS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</select>
      </Field>
      <Field label="Target"><input name="target" type="number" min="1" step="any" required className="field" /></Field>
      <Field label="From"><input name="start_date" type="date" defaultValue={ms} required className="field" /></Field>
      <Field label="To"><input name="end_date" type="date" defaultValue={me} required className="field" /></Field>
      <Field label="For" className="lg:col-span-2">
        <select name="staff_id" className="field"><option value="">Whole company</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}</select>
      </Field>
      <div className="flex items-end lg:col-span-4 lg:justify-end"><SubmitButton pendingText="Adding…">Add goal</SubmitButton></div>
    </form>
  );
}
