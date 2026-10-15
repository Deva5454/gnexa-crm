"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { FormError } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { cn } from "@/lib/utils";
import { addReply } from "../actions";

const MODES = [
  { key: "reply", label: "Reply to customer", hint: "Visible to the customer · sets status to Answered" },
  { key: "note", label: "Internal note", hint: "Only your team sees this" },
  { key: "customer", label: "Log customer message", hint: "Paste an email or call summary from the customer · re-opens the ticket" },
] as const;

export function ReplyBox({ ticketId, contactName }: { ticketId: number; contactName: string }) {
  const [mode, setMode] = useState<(typeof MODES)[number]["key"]>("reply");
  const [state, action] = useActionState(addReply, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  const m = MODES.find((x) => x.key === mode)!;
  return (
    <form ref={ref} action={action} className={cn("overflow-hidden rounded-2xl border bg-white shadow-card", mode === "note" ? "border-amber-200" : "border-slate-200")}>
      <input type="hidden" name="ticket_id" value={ticketId} />
      <input type="hidden" name="mode" value={mode} />
      <div className="flex gap-1 border-b border-slate-100 px-3 pt-3">
        {MODES.map((x) => (
          <button
            key={x.key}
            type="button"
            onClick={() => setMode(x.key)}
            className={cn(
              "-mb-px rounded-t-lg border-b-2 px-3 py-2 text-xs font-semibold",
              mode === x.key ? (x.key === "note" ? "border-amber-500 text-amber-700" : "border-brand-600 text-brand-700") : "border-transparent text-slate-500 hover:text-slate-800",
            )}
          >
            {x.label}
          </button>
        ))}
      </div>
      <div className={cn("p-4", mode === "note" && "bg-amber-50/40")}>
        <textarea
          name="body"
          required
          rows={5}
          placeholder={mode === "reply" ? `Hi ${contactName.split(" ")[0] || "there"},\n\n` : mode === "note" ? "Investigation notes, next steps…" : "What the customer said…"}
          className="field resize-y"
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-slate-500">{m.hint}</p>
          <div className="flex gap-2">
            {mode === "reply" && (
              <button type="submit" name="close" value="1" className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
                Reply & close
              </button>
            )}
            <SubmitButton size="sm" pendingText="Saving…">{mode === "reply" ? "Send reply" : mode === "note" ? "Add note" : "Log message"}</SubmitButton>
          </div>
        </div>
        <FormError message={state?.error} />
        {state?.ok && <p className="mt-2 text-sm text-emerald-600">{state.ok}</p>}
      </div>
    </form>
  );
}
