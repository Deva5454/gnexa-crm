"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/ui/submit-button";
import { requestPrivacy, setConsent, type PortalState } from "../actions";

export function ConsentForm({ consent }: { consent: boolean }) {
  const [state, action] = useActionState<PortalState, FormData>(setConsent, undefined);
  return (
    <form action={action} className="space-y-3">
      <label className="flex items-start gap-3 text-sm text-slate-700">
        <input type="checkbox" name="consent" defaultChecked={consent} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600" />
        <span>Send me product news, tips and offers by e-mail. <span className="block text-xs text-slate-500">Invoices, receipts and support replies are always sent.</span></span>
      </label>
      {state?.ok && <p className="text-xs text-emerald-600">{state.ok}</p>}
      {state?.error && <p className="text-xs text-rose-600">{state.error}</p>}
      <SubmitButton size="sm" variant="secondary" pendingText="Saving…">Save preference</SubmitButton>
    </form>
  );
}

export function ErasureForm() {
  const [state, action] = useActionState<PortalState, FormData>(requestPrivacy, undefined);
  if (state?.ok) return <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{state.ok}</p>;
  return (
    <form action={action} onSubmit={(e) => { if (!confirm("Ask us to delete your personal details? Your company's invoices are kept for tax purposes, but your name and contact details will be removed and you will lose portal access.")) e.preventDefault(); }} className="space-y-3">
      <input type="hidden" name="kind" value="erasure" />
      <textarea name="note" rows={2} maxLength={1000} placeholder="Anything we should know? (optional)" className="field" />
      {state?.error && <p className="text-xs text-rose-600">{state.error}</p>}
      <SubmitButton size="sm" variant="danger" pendingText="Sending…">Request deletion</SubmitButton>
    </form>
  );
}
