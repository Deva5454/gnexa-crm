"use client";

import { useEffect, useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";

/** Shows the public link and embed code for a form or survey, using this site's address. */
export function CopyBox({ path, embed = true }: { path: string; embed?: boolean }) {
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  useEffect(() => setOrigin(window.location.origin), []);
  const url = `${origin}${path}`;
  const code = `<iframe src="${url}?embed=1" style="width:100%;min-height:620px;border:0" title="Contact form"></iframe>`;
  const copy = async (what: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      window.prompt("Copy:", text);
    }
  };
  const Btn = ({ what, text }: { what: string; text: string }) => (
    <button type="button" onClick={() => copy(what, text)} className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50">
      {copied === what ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />} {copied === what ? "Copied" : "Copy"}
    </button>
  );
  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded bg-slate-50 px-2 py-1.5 text-slate-600 ring-1 ring-slate-200" suppressHydrationWarning>{url}</code>
        <a href={path} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 font-medium text-slate-600 hover:bg-slate-50"><ExternalLink className="h-3.5 w-3.5" /> Open</a>
        <Btn what="link" text={url} />
      </div>
      {embed && (
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded bg-slate-50 px-2 py-1.5 text-slate-500 ring-1 ring-slate-200" suppressHydrationWarning>{code}</code>
          <Btn what="embed" text={code} />
        </div>
      )}
    </div>
  );
}
