"use client";

import { useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** In-card tabs that switch without a page load (arrow keys move between tabs). */
export function PanelTabs({ tabs }: { tabs: { key: string; label: string; count?: number; content: React.ReactNode }[] }) {
  const [active, setActive] = useState(tabs[0]?.key);
  const id = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const move = (i: number) => {
    const n = (i + tabs.length) % tabs.length;
    setActive(tabs[n]!.key);
    refs.current[n]?.focus();
  };
  return (
    <>
      <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-slate-100 px-3">
        {tabs.map((t, i) => {
          const on = t.key === active;
          return (
            <button
              key={t.key}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`${id}-tab-${t.key}`}
              aria-selected={on}
              aria-controls={`${id}-panel-${t.key}`}
              tabIndex={on ? 0 : -1}
              onClick={() => setActive(t.key)}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight") move(i + 1);
                if (e.key === "ArrowLeft") move(i - 1);
              }}
              className={cn(
                "-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-2.5 py-3 text-sm font-medium transition-colors",
                on ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-800",
              )}
            >
              {t.label}
              {t.count != null && (
                <span className={cn("rounded-full px-1.5 text-[11px]", on ? "bg-brand-100 text-brand-700" : "bg-slate-100 text-slate-500")}>{t.count}</span>
              )}
            </button>
          );
        })}
      </div>
      {tabs.map((t) => (
        <div key={t.key} role="tabpanel" id={`${id}-panel-${t.key}`} aria-labelledby={`${id}-tab-${t.key}`} hidden={t.key !== active}>
          {t.content}
        </div>
      ))}
    </>
  );
}
