"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Check, ChevronDown, Loader2, LogOut, Repeat2, UserRound } from "lucide-react";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { signOut } from "@/lib/actions/auth";
import { DEMO_PERSONAS } from "@/lib/demo";
import { cn } from "@/lib/utils";

const ROLE_TINT: Record<string, string> = {
  admin: "bg-brand-100 text-brand-700",
  manager: "bg-teal-100 text-teal-700",
  executive: "bg-amber-100 text-amber-700",
  support: "bg-sky-100 text-sky-700",
};

/** The signed-in person's menu. In the demo it also switches between the demo roles. */
export function RoleSwitcher({ name, roleName, personaKey, demo }: { name: string; roleName: string; personaKey?: string; demo: boolean }) {
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const params = useSearchParams();

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", h);
    document.addEventListener("keydown", k);
    return () => {
      document.removeEventListener("mousedown", h);
      document.removeEventListener("keydown", k);
    };
  }, []);

  // Stay on the same page after switching, unless it's an admin-only area or the other side (CRM ↔ portal)
  const qs = params.toString();
  const inPortal = pathname.startsWith("/portal");
  const hrefFor = (p: (typeof DEMO_PERSONAS)[number]) => {
    const here = `${pathname}${qs ? `?${qs}` : ""}`;
    const next = p.client ? (inPortal ? here : "/portal") : inPortal || pathname.startsWith("/settings") ? "/dashboard" : here;
    return `/demo?as=${p.key}&next=${encodeURIComponent(next)}`;
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white py-1 pl-1 pr-2 shadow-sm hover:border-brand-200"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Avatar name={name} />
        <span className="hidden text-left leading-tight md:block">
          <span className="block max-w-[140px] truncate text-sm font-semibold text-slate-800">{name}</span>
          <span className="block text-[11px] font-medium text-slate-500">{roleName}</span>
        </span>
        {demo && (
          <span className="ml-1 hidden items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:flex">
            <Repeat2 className="h-3 w-3" /> Switch
          </span>
        )}
        <ChevronDown className="h-4 w-4 text-slate-400" />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 max-h-[80vh] w-80 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-pop" role="menu">
          {demo && (
          <>
          <div className="bg-ink-900 px-4 py-3 text-white">
            <div className="text-xs font-semibold uppercase tracking-wider text-accent-400">Demo mode</div>
            <div className="mt-0.5 text-sm text-slate-300">Switch role to see what each team member can do.</div>
          </div>
          <ul className="p-1.5">
            {DEMO_PERSONAS.map((p, i) => {
              const active = p.key === personaKey;
              const header = i === 0 ? "Team" : p.client && !DEMO_PERSONAS[i - 1]!.client ? "Client portal" : null;
              return (
                <li key={p.key}>
                  {header && <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">{header}</div>}
                  <a
                    role="menuitem"
                    href={hrefFor(p)}
                    onClick={() => setSwitching(p.key)}
                    aria-current={active || undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors",
                      active ? "bg-brand-50" : "hover:bg-slate-50",
                    )}
                  >
                    <Avatar name={p.name} className="h-9 w-9" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold text-slate-900">{p.name}</span>
                        <span className={cn("truncate rounded-full px-2 py-0.5 text-[10px] font-semibold", ROLE_TINT[p.key] ?? "bg-slate-100 text-slate-600")}>{p.client ? "Client" : p.role}</span>
                      </span>
                      <span className="block truncate text-xs text-slate-500">{p.client ? p.role.replace("Client · ", "") : p.blurb}</span>
                    </span>
                    {switching === p.key ? (
                      <Loader2 className="h-4 w-4 animate-spin text-brand-500" />
                    ) : (
                      active && <Check className="h-4 w-4 text-brand-600" />
                    )}
                  </a>
                </li>
              );
            })}
          </ul>
          </>
          )}
          <div className="border-t border-slate-100 p-1.5">
            {!inPortal && (
              <Link
                href="/profile"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                <UserRound className="h-4 w-4" /> My profile & permissions
              </Link>
            )}
            <form action={signOut}>
              <button type="submit" className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
