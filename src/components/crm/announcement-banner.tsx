"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Megaphone, X } from "lucide-react";

/** Latest team announcement on the dashboard; dismissal is remembered in this browser. */
export function AnnouncementBanner({ id, title, body }: { id: number; title: string; body: string }) {
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    try {
      setHidden(localStorage.getItem("gnexa:announcement") === String(id));
    } catch {
      setHidden(false);
    }
  }, [id]);
  if (hidden) return null;
  return (
    <div className="mb-6 flex gap-3 rounded-2xl border border-brand-100 bg-brand-50/70 px-5 py-4">
      <Megaphone className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-slate-900">{title}</div>
        <p className="line-clamp-2 text-sm text-slate-600">{body}</p>
        <Link href="/announcements" className="text-xs font-semibold text-brand-600 hover:text-brand-700">All announcements →</Link>
      </div>
      <button
        onClick={() => {
          try {
            localStorage.setItem("gnexa:announcement", String(id));
          } catch {}
          setHidden(true);
        }}
        className="self-start rounded p-1 text-slate-400 hover:bg-white hover:text-slate-700"
        aria-label="Dismiss announcement"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
