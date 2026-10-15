"use client";

import { useActionState } from "react";
import { CheckCircle2 } from "lucide-react";
import { SubmitButton } from "@/components/ui/submit-button";
import { submitPublicForm, type PublicState } from "./actions";

const LABELS: Record<string, { label: string; type?: string; textarea?: boolean; placeholder?: string }> = {
  name: { label: "Your name" },
  email: { label: "E-mail", type: "email" },
  phone: { label: "Phone", type: "tel" },
  company: { label: "Company" },
  budget: { label: "Budget", placeholder: "e.g. ₹2–5 lakh" },
  message: { label: "How can we help?", textarea: true },
};

export function PublicForm({ formKey, fields, required, kind }: { formKey: string; fields: string[]; required: string[]; kind: string }) {
  const [state, action] = useActionState<PublicState, FormData>(submitPublicForm.bind(null, formKey), undefined);
  if (state?.ok)
    return (
      <div className="py-6 text-center">
        <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-accent-500" />
        <p className="text-base font-semibold text-slate-900">{state.ok}</p>
      </div>
    );
  return (
    <form action={action} className="space-y-4">
      {fields.filter((f) => LABELS[f]).map((f) => {
        const m = LABELS[f]!;
        const req = required.includes(f);
        return (
          <div key={f}>
            <label htmlFor={f} className="label">{m.label}{req && <span className="text-rose-500"> *</span>}</label>
            {m.textarea ? (
              <textarea id={f} name={f} required={req} rows={4} maxLength={4000} className="field" />
            ) : (
              <input id={f} name={f} type={m.type ?? "text"} required={req} maxLength={f === "email" ? 160 : 200} placeholder={m.placeholder} className="field" autoComplete={f === "name" ? "name" : f === "email" ? "email" : f === "phone" ? "tel" : f === "company" ? "organization" : undefined} />
            )}
          </div>
        );
      })}
      {/* Honeypot — hidden from people, irresistible to bots */}
      <div aria-hidden className="absolute -left-[9999px] h-0 overflow-hidden">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      {state?.error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{state.error}</p>}
      <SubmitButton className="w-full" pendingText="Sending…">{kind === "estimate_request" ? "Request a quote" : "Send"}</SubmitButton>
      <p className="text-center text-[11px] text-slate-400">We use your details only to respond to this enquiry.</p>
    </form>
  );
}
