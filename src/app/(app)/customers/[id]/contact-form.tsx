"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FormError } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { addContact } from "../actions";

export function ContactForm({ customerId }: { customerId: number }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(addContact, undefined);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state && !state.error) {
      ref.current?.reset();
      setOpen(false);
    }
  }, [state]);

  if (!open) {
    return (
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        <Plus className="h-3.5 w-3.5" /> Add contact
      </Button>
    );
  }
  return (
    <form ref={ref} action={action} className="mt-4 w-full space-y-4 rounded-xl border border-brand-100 bg-brand-50/40 p-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">New contact</h4>
        <button type="button" onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-700" aria-label="Close">
          <X className="h-4 w-4" />
        </button>
      </div>
      <FormError message={state?.error} />
      <input type="hidden" name="customer_id" value={customerId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="First name *"><input name="first_name" required className="field" /></Field>
        <Field label="Last name"><input name="last_name" className="field" /></Field>
        <Field label="Email"><input name="email" type="email" className="field" /></Field>
        <Field label="Phone"><input name="phone" className="field" /></Field>
        <Field label="Position"><input name="title" className="field" /></Field>
        <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-600">
          <input type="checkbox" name="is_primary" className="h-4 w-4 rounded border-slate-300 text-brand-600" /> Primary contact
        </label>
      </div>
      <div className="flex justify-end">
        <SubmitButton size="sm" pendingText="Adding…">Save contact</SubmitButton>
      </div>
    </form>
  );
}
