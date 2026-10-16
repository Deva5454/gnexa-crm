"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Check, Copy, Send } from "lucide-react";
import { addDocComment } from "@/app/(app)/sales/actions";
import { FormError } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";

export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex gap-1.5">
      <input readOnly value={url} aria-label="Public link" onFocus={(e) => e.currentTarget.select()} className="field h-8 min-w-0 flex-1 py-0 text-xs" />
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            /* clipboard blocked — the field is selectable */
          }
        }}
        className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />} {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

export function StaffCommentForm({ docId }: { docId: number }) {
  const [state, action] = useActionState(addDocComment, undefined);
  const body = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (state?.ok && body.current) body.current.value = "";
  }, [state]);
  return (
    <form action={action} className="space-y-2">
      <FormError message={state?.error} />
      <input type="hidden" name="doc_id" value={docId} />
      <textarea ref={body} name="body" rows={2} maxLength={2000} required placeholder="Reply to the client…" aria-label="Reply" className="field text-sm" />
      <SubmitButton size="sm" variant="secondary" pendingText="Posting…"><Send className="h-3.5 w-3.5" /> Post</SubmitButton>
    </form>
  );
}
