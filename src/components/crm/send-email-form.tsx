"use client";

import { useActionState, useState } from "react";
import { BellRing, Mail, Paperclip } from "lucide-react";
import { SubmitButton } from "@/components/ui/submit-button";
import type { EmailState } from "@/lib/actions/email";
import { KeepValues } from "@/components/ui/keep-values";

export type Recipient = { email: string; name: string | null };

/** Compose box for a simulated e-mail. `hidden` carries ids; the action decides what gets logged. */
export function SendEmailForm({
  action,
  hidden,
  recipients,
  subject,
  body,
  attachment,
  label = "Send e-mail",
  buttonLabel = "Send",
  icon = "mail",
  tone = "secondary",
}: {
  action: (s: EmailState, f: FormData) => Promise<EmailState>;
  hidden: Record<string, string | number>;
  recipients: Recipient[];
  subject: string;
  body: string;
  attachment?: string;
  label?: string;
  buttonLabel?: string;
  icon?: "mail" | "bell";
  tone?: "secondary" | "primary";
}) {
  const [open, setOpen] = useState(false);
  const Icon = icon === "bell" ? BellRing : Mail;
  const [state, formAction] = useActionState(action, undefined);
  if (!open)
    return (
      <div className="space-y-1">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={
            tone === "primary"
              ? "flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-brand-600 text-sm font-semibold text-white hover:bg-brand-700"
              : "flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50"
          }
        >
          <Icon className="h-4 w-4" /> {label}
        </button>
        {state?.ok && <p className="text-center text-xs text-emerald-600">{state.ok}</p>}
      </div>
    );
  return (
    <form action={async (fd) => { await formAction(fd); }} className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      {recipients.length ? (
        <select name="to" defaultValue={`${recipients[0]!.email}|${recipients[0]!.name ?? ""}`} className="field" aria-label="To">
          {recipients.map((r) => (
            <option key={r.email} value={`${r.email}|${r.name ?? ""}`}>{r.name ? `${r.name} <${r.email}>` : r.email}</option>
          ))}
        </select>
      ) : (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">No contact e-mail on file — add one to the customer first.</p>
      )}
      <input name="subject" defaultValue={subject} required className="field" aria-label="Subject" />
      <textarea name="body" defaultValue={body} required rows={7} className="field resize-y" aria-label="Message" />
      {attachment && <p className="flex items-center gap-1.5 text-xs text-slate-500"><Paperclip className="h-3.5 w-3.5" /> {attachment}</p>}
      <KeepValues active={!!state?.error} />
      {state?.error && <p className="text-xs text-rose-600">{state.error}</p>}
      {state?.ok && <p className="text-xs text-emerald-600">{state.ok}</p>}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-slate-400">Demo: logged, not delivered</span>
        <div className="flex gap-2">
          <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100">Close</button>
          <SubmitButton size="sm" pendingText="Sending…">{buttonLabel}</SubmitButton>
        </div>
      </div>
    </form>
  );
}
