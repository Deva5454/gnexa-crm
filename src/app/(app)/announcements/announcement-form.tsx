"use client";

import { useActionState, useEffect, useRef } from "react";
import { Field, FormError } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { postAnnouncement } from "./actions";

export function AnnouncementForm() {
  const [state, action] = useActionState(postAnnouncement, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="space-y-3">
      <FormError message={state?.error} />
      {state?.ok && <p className="text-sm text-emerald-600">{state.ok}</p>}
      <Field label="Title"><input name="title" required className="field" /></Field>
      <Field label="Message"><textarea name="body" required rows={4} className="field" /></Field>
      <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
        <label className="flex items-center gap-2"><input type="checkbox" name="show_to_staff" defaultChecked className="h-4 w-4 rounded border-slate-300 text-brand-600" /> Team dashboard</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="show_to_clients" className="h-4 w-4 rounded border-slate-300 text-brand-600" /> Client portal</label>
        <SubmitButton className="ml-auto" pendingText="Posting…">Post</SubmitButton>
      </div>
    </form>
  );
}
