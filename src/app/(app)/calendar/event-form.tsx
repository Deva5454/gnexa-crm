"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Field, FormError } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { addEvent } from "./actions";

const COLORS = ["#6d55f2", "#0d9488", "#f59e0b", "#e11d48", "#0ea5e9"];

export function EventForm({ defaultDate }: { defaultDate: string }) {
  const [state, action] = useActionState(addEvent, undefined);
  const [allDay, setAllDay] = useState(false);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="space-y-3">
      <FormError message={state?.error} />
      {state?.ok && <p className="text-sm text-emerald-600">{state.ok}</p>}
      <Field label="Title"><input name="title" required className="field" /></Field>
      <Field label="Date"><input name="date" type="date" defaultValue={defaultDate} required className="field" /></Field>
      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input type="checkbox" name="all_day" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-brand-600" /> All day
      </label>
      {!allDay && (
        <div className="grid grid-cols-2 gap-2">
          <Field label="Starts"><input name="start" type="time" defaultValue="10:00" className="field" /></Field>
          <Field label="Ends"><input name="end" type="time" defaultValue="11:00" className="field" /></Field>
        </div>
      )}
      <Field label="Notes"><textarea name="description" rows={2} className="field" /></Field>
      <fieldset>
        <legend className="label">Colour</legend>
        <div className="flex gap-2">
          {COLORS.map((c, i) => (
            <label key={c} className="cursor-pointer">
              <input type="radio" name="color" value={c} defaultChecked={i === 0} className="peer sr-only" />
              <span className="block h-6 w-6 rounded-full ring-2 ring-transparent ring-offset-2 peer-checked:ring-slate-400" style={{ background: c }} />
            </label>
          ))}
        </div>
      </fieldset>
      <SubmitButton className="w-full" pendingText="Adding…">Add event</SubmitButton>
    </form>
  );
}
