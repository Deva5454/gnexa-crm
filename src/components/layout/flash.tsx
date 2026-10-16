"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";

/** Shows the reason a form action failed (handed over by withFlash), then clears it. */
export function Flash({ flash }: { flash: { id: number; message: string } | null }) {
  const [shown, setShown] = useState(flash);

  useEffect(() => {
    if (!flash) return;
    setShown(flash);
    document.cookie = "gnexa_flash=; Max-Age=0; path=/";
    const t = setTimeout(() => setShown((s) => (s?.id === flash.id ? null : s)), 8000);
    return () => clearTimeout(t);
  }, [flash]);

  if (!shown) return null;
  return (
    <div role="alert" className="fixed bottom-5 left-1/2 z-[60] flex w-[min(92vw,30rem)] -translate-x-1/2 items-start gap-3 rounded-xl border border-rose-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-lg">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
      <p className="min-w-0 flex-1">{shown.message}</p>
      <button type="button" onClick={() => setShown(null)} className="text-slate-400 hover:text-slate-600" aria-label="Dismiss">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
