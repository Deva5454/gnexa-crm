"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Link2, Loader2, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { recordMedia, shareLink } from "./actions";

export function MediaUploader({ folder, folders }: { folder: string; folders: string[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState(folder);
  const input = useRef<HTMLInputElement>(null);
  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    for (const file of Array.from(files)) {
      if (file.size > 20 * 1024 * 1024) {
        setError(`${file.name} is larger than 20 MB.`);
        continue;
      }
      const path = `lib/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
      const { error: upErr } = await supabase.storage.from("media").upload(path, file, { contentType: file.type || undefined });
      if (upErr) {
        setError(`${file.name}: ${upErr.message}`);
        continue;
      }
      const r = await recordMedia({ folder: target || "General", name: file.name, path, size: file.size, mime: file.type || null });
      if (r.error) setError(r.error);
    }
    setBusy(false);
    if (input.current) input.current.value = "";
    router.refresh();
  };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <label htmlFor="media-folder" className="text-slate-500">Upload to folder</label>
        <input id="media-folder" list="media-folders" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="General" className="field h-8 max-w-[14rem] text-sm" />
        <datalist id="media-folders">{folders.map((f) => <option key={f} value={f} />)}</datalist>
      </div>
      <label
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          upload(e.dataTransfer.files);
        }}
        className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500 hover:border-brand-300 hover:bg-brand-50/40"
      >
        {busy ? <Loader2 className="h-5 w-5 animate-spin text-brand-500" /> : <Upload className="h-5 w-5 text-brand-500" />}
        <span><b className="text-slate-700">Upload files</b> · drag here or click · max 20 MB each</span>
        <input ref={input} type="file" multiple className="hidden" onChange={(e) => upload(e.target.files)} disabled={busy} />
      </label>
      {error && <p className="text-sm text-rose-600">{error}</p>}
    </div>
  );
}

export function ShareButton({ id }: { id: number }) {
  const [state, setState] = useState<"idle" | "copied" | "error">("idle");
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await shareLink(id);
          if (r.url) {
            try {
              await navigator.clipboard.writeText(r.url);
              setState("copied");
            } catch {
              window.prompt("Copy this link (valid 7 days):", r.url);
            }
          } else setState("error");
          setTimeout(() => setState("idle"), 2500);
        })
      }
      className="rounded p-1 text-slate-400 hover:text-brand-700"
      aria-label="Copy a 7-day share link"
      title="Copy a 7-day share link"
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : state === "copied" ? <Check className="h-4 w-4 text-emerald-600" /> : <Link2 className="h-4 w-4" />}
    </button>
  );
}
