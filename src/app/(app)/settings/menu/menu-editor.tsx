"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Eye, EyeOff } from "lucide-react";
import { SubmitButton } from "@/components/ui/submit-button";
import { cn } from "@/lib/utils";
import { resetMenu, saveMenu } from "../actions";

export type MenuGroup = { key: string; label: string; items: { href: string; label: string }[] };

export function MenuEditor({ groups, hidden: initialHidden }: { groups: MenuGroup[]; hidden: string[] }) {
  const [order, setOrder] = useState<Record<string, string[]>>(() => Object.fromEntries(groups.map((g) => [g.key, g.items.map((i) => i.href)])));
  const [hidden, setHidden] = useState<string[]>(initialHidden);
  const labels = Object.fromEntries(groups.flatMap((g) => g.items.map((i) => [i.href, i.label])));

  const move = (key: string, idx: number, by: -1 | 1) =>
    setOrder((o) => {
      const list = [...o[key]!];
      const j = idx + by;
      if (j < 0 || j >= list.length) return o;
      [list[idx], list[j]] = [list[j]!, list[idx]!];
      return { ...o, [key]: list };
    });
  const toggle = (href: string) => setHidden((h) => (h.includes(href) ? h.filter((x) => x !== href) : [...h, href]));

  return (
    <div>
      <div className="grid gap-6 p-5 md:grid-cols-2">
        {groups.map((g) => (
          <section key={g.key}>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{g.label}</h3>
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
              {order[g.key]!.map((href, i) => {
                const off = hidden.includes(href);
                const locked = href === "/settings";
                return (
                  <li key={href} className={cn("flex items-center gap-2 px-3 py-2 text-sm", off && "bg-slate-50 text-slate-400")}>
                    <span className="flex-1 truncate">{labels[href]}</span>
                    <button type="button" onClick={() => move(g.key, i, -1)} disabled={i === 0} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30" aria-label={`Move ${labels[href]} up`}>
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => move(g.key, i, 1)} disabled={i === order[g.key]!.length - 1} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30" aria-label={`Move ${labels[href]} down`}>
                      <ChevronDown className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => toggle(href)} disabled={locked} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30" aria-label={off ? `Show ${labels[href]}` : `Hide ${labels[href]}`} aria-pressed={off}>
                      {off ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 px-5 py-4">
        <form action={saveMenu}>
          <input type="hidden" name="menu" value={JSON.stringify({ order, hidden })} />
          <SubmitButton pendingText="Saving…">Save menu</SubmitButton>
        </form>
        <form action={resetMenu}>
          <SubmitButton variant="secondary" pendingText="Resetting…">Reset to default</SubmitButton>
        </form>
      </div>
    </div>
  );
}
