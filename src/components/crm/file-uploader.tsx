"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Record = (input: { rel_id: number; name: string; path: string; size: number; mime: string | null }) => Promise<{ error?: string }>;

/** Drag-or-click attachment uploader: files go straight to a private bucket under `<relId>/`, then `record` saves the row. */
export function FileUploader({ bucket, relId, record }: { bucket: string; relId: number; record: Record }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    for (const file of Array.from(files)) {
      if (file.size > 10 * 1024 * 1024) {
        setError(`${file.name} is larger than 10 MB.`);
        continue;
      }
      const path = `${relId}/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
      const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type || undefined });
      if (upErr) {
        setError(`${file.name}: ${upErr.message}`);
        continue;
      }
      const res = await record({ rel_id: relId, name: file.name, path, size: file.size, mime: file.type || null });
      if (res?.error) setError(res.error);
    }
    setBusy(false);
    if (input.current) input.current.value = "";
    router.refresh();
  };

  return (
    <div>
      <label
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          upload(e.dataTransfer.files);
        }}
        className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 px-4 py-4 text-sm text-slate-500 hover:border-brand-300 hover:bg-brand-50/40 focus-within:border-brand-400 focus-within:ring-4 focus-within:ring-brand-100"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin text-brand-500" /> : <Upload className="h-4 w-4 text-brand-500" />}
        <span><b className="text-slate-700">Attach files</b> · drag here or click · max 10 MB</span>
        <input ref={input} type="file" multiple className="sr-only" onChange={(e) => upload(e.target.files)} disabled={busy} />
      </label>
      {error && <p className="mt-2 text-sm text-rose-600" role="alert">{error}</p>}
    </div>
  );
}
