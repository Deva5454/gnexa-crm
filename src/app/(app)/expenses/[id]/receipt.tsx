"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { recordReceipt } from "../actions";

export function ReceiptUploader({ expenseId, replace }: { expenseId: number; replace: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) return setError("Receipts must be under 10 MB.");
    setBusy(true);
    setError(null);
    const path = `${expenseId}/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
    const { error: upErr } = await createClient().storage.from("expense-receipts").upload(path, file, { contentType: file.type || undefined });
    if (upErr) setError(upErr.message);
    else {
      const r = await recordReceipt(expenseId, path, file.name);
      if (r.error) setError(r.error);
    }
    setBusy(false);
    if (input.current) input.current.value = "";
    router.refresh();
  };
  return (
    <div>
      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 px-4 py-4 text-sm text-slate-500 hover:border-brand-300 hover:bg-brand-50/40 focus-within:border-brand-400 focus-within:ring-4 focus-within:ring-brand-100">
        {busy ? <Loader2 className="h-4 w-4 animate-spin text-brand-500" /> : <Upload className="h-4 w-4 text-brand-500" />}
        <span><b className="text-slate-700">{replace ? "Replace receipt" : "Upload receipt"}</b> · photo or PDF, max 10 MB</span>
        <input ref={input} type="file" accept="image/*,application/pdf" className="sr-only" onChange={(e) => upload(e.target.files?.[0])} disabled={busy} />
      </label>
      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
    </div>
  );
}
