"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Check, Download, PenLine, ThumbsDown, ThumbsUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FormError } from "@/components/ui/field";
import { rememberSubmitter, SubmitButton } from "@/components/ui/submit-button";
import { TASK_PRIORITIES } from "@/lib/constants";
import { openTicket, replyToTicket, respondToQuote, signContract, trackArticle } from "./actions";

function Ok({ text }: { text?: string }) {
  return text ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{text}</div> : null;
}

export function PrintButton({ label = "Download PDF" }: { label?: string }) {
  return (
    <Button size="sm" variant="secondary" onClick={() => window.print()}>
      <Download className="h-3.5 w-3.5" /> {label}
    </Button>
  );
}

export function QuoteResponse({ id, kindLabel, defaultName }: { id: number; kindLabel: string; defaultName: string }) {
  const [state, action] = useActionState(respondToQuote, undefined);
  const [name, setName] = useState(defaultName);
  if (state?.ok) return <Ok text={state.ok} />;
  return (
    <form action={action} className="space-y-3">
      <FormError message={state?.error} />
      <input type="hidden" name="id" value={id} />
      <p className="text-sm text-slate-600">Happy with this {kindLabel.toLowerCase()}? Type your name to accept it and we&apos;ll get started.</p>
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

export function SignContractForm({ id, defaultName }: { id: number; defaultName: string }) {
  const [state, action] = useActionState(signContract, undefined);
  const [name, setName] = useState(defaultName);
  if (state?.ok) return <Ok text={state.ok} />;
  return (
    <form action={action} className="space-y-3">
      <FormError message={state?.error} />
      <input type="hidden" name="id" value={id} />
      <Field label="Type your full name to sign">
        <input name="name" value={name} onChange={(e) => setName(e.target.value)} required className="field" />
      </Field>
      <div className="flex h-14 items-end rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 pb-2 font-serif text-2xl italic text-brand-800">{name}</div>
      <label className="flex items-start gap-2 text-xs text-slate-600">
        <input type="checkbox" name="agree" className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600" />
        I have read the agreement and agree to its terms. Typing my name is my electronic signature.
      </label>
      <SubmitButton className="w-full" variant="accent" pendingText="Signing…"><PenLine className="h-4 w-4" /> Sign agreement</SubmitButton>
    </form>
  );
}

export function NewTicketForm({ departments }: { departments: { id: number; name: string }[] }) {
  const [state, action] = useActionState(openTicket, undefined);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2"><FormError message={state?.error} /></div>
      <Field label="Subject *" className="sm:col-span-2"><input name="subject" required className="field" /></Field>
      <Field label="Department">
        <select name="department_id" defaultValue={departments[0]?.id ?? ""} className="field">
          <option value="">—</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </Field>
      <Field label="Priority">
        <select name="priority" defaultValue="medium" className="field">
          {TASK_PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </Field>
      <Field label="How can we help? *" className="sm:col-span-2"><textarea name="body" required rows={7} className="field" /></Field>
      <div className="flex justify-end sm:col-span-2"><SubmitButton pendingText="Sending…">Submit ticket</SubmitButton></div>
    </form>
  );
}

export function TicketReply({ id }: { id: number }) {
  const [state, action] = useActionState(replyToTicket, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
      <input type="hidden" name="id" value={id} />
      <FormError message={state?.error} />
      <textarea name="body" required rows={4} placeholder="Write a reply…" className="field" />
      <div className="flex justify-end"><SubmitButton size="sm" pendingText="Sending…">Send reply</SubmitButton></div>
    </form>
  );
}

export function ArticleFeedbackPortal({ id }: { id: number }) {
  const [voted, setVoted] = useState(false);
  useEffect(() => {
    const key = `gnexa:portal-kb:${id}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {}
    trackArticle(id, "view");
  }, [id]);
  if (voted) return <p className="text-sm text-emerald-600">Thanks for the feedback!</p>;
  const vote = (yes: boolean) => {
    setVoted(true);
    trackArticle(id, yes ? "yes" : "no");
  };
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
      Did this answer your question?
      <button onClick={() => vote(true)} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 hover:bg-emerald-50 hover:text-emerald-700"><ThumbsUp className="h-4 w-4" /> Yes</button>
      <button onClick={() => vote(false)} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 hover:bg-rose-50 hover:text-rose-700"><ThumbsDown className="h-4 w-4" /> No</button>
    </div>
  );
}
