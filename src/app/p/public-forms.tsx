"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Check, Download, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FormError } from "@/components/ui/field";
import { rememberSubmitter, SubmitButton } from "@/components/ui/submit-button";
import { commentPublic, respondPublic } from "./actions";

const Ok = ({ text }: { text?: string }) => (text ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700" role="status">{text}</div> : null);

export function PrintButton() {
  return (
    <Button size="sm" variant="secondary" onClick={() => window.print()}>
      <Download className="h-3.5 w-3.5" /> Download PDF
    </Button>
  );
}

export function RespondForm({ token, kindLabel }: { token: string; kindLabel: string }) {
  const [state, action] = useActionState(respondPublic, undefined);
  const [name, setName] = useState("");
  if (state?.ok) return <Ok text={state.ok} />;
  return (
    <form action={action} className="space-y-3">
      <FormError message={state?.error} />
      <input type="hidden" name="token" value={token} />
      <Field label="Your full name (needed to accept)">
        <input name="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className="field" />
      </Field>
      <div className="flex h-12 items-end rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 pb-1.5 font-serif text-xl italic text-brand-800" aria-hidden>{name}</div>
      <label className="flex items-start gap-2 text-xs text-slate-600">
        <input type="checkbox" name="agree" className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600" />
        I accept this {kindLabel.toLowerCase()}, its prices and terms. Typing my name is my electronic signature.
      </label>
      <div className="flex gap-2">
        <button type="submit" name="decision" value="accept" onClick={(e) => rememberSubmitter(e.currentTarget, "decision", "accept")} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-accent-600 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-500">
          <Check className="h-4 w-4" /> Accept
        </button>
        <button type="submit" name="decision" value="decline" onClick={(e) => rememberSubmitter(e.currentTarget, "decision", "decline")} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
          <X className="h-4 w-4" /> Decline
        </button>
      </div>
    </form>
  );
}

export function CommentForm({ token }: { token: string }) {
  const [state, action] = useActionState(commentPublic, undefined);
  const body = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (state?.ok && body.current) body.current.value = "";
  }, [state]);
  return (
    <form action={action} className="space-y-2">
      <FormError message={state?.error} />
      <input type="hidden" name="token" value={token} />
      <input name="name" required maxLength={120} placeholder="Your name" aria-label="Your name" autoComplete="name" className="field" />
      <textarea ref={body} name="body" required rows={3} maxLength={2000} placeholder="Ask a question or suggest a change…" aria-label="Comment" className="field" />
      <SubmitButton size="sm" pendingText="Posting…"><Send className="h-3.5 w-3.5" /> Post comment</SubmitButton>
    </form>
  );
}
