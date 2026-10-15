"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, ChevronDown, ListChecks, LogOut, Magnet, Menu, Plus, Search, UserRound } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { createClient } from "@/lib/supabase/client";

function useClickAway(onAway: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onAway();
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onAway]);
  return ref;
}

export function Topbar({ name, email, onMenu }: { name: string; email: string; onMenu: () => void }) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const createRef = useClickAway(() => setCreateOpen(false));
  const userRef = useClickAway(() => setUserOpen(false));

  const signOut = async () => {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200/70 bg-white/80 px-4 backdrop-blur sm:px-6">
      <button onClick={onMenu} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden" aria-label="Open menu">
        <Menu className="h-5 w-5" />
      </button>

      <form action="/search" className="relative max-w-md flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          name="q"
          type="search"
          placeholder="Search customers, leads, tasks…"
          className="h-10 w-full rounded-xl border border-transparent bg-slate-100/80 pl-9 pr-3 text-sm placeholder:text-slate-400 focus:border-brand-300 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-100"
        />
      </form>

      <div className="ml-auto flex items-center gap-2">
        <div className="relative" ref={createRef}>
          <button
            onClick={() => setCreateOpen((o) => !o)}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-aurora px-3 text-sm font-semibold text-white shadow-sm hover:opacity-95"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Create</span>
          </button>
          {createOpen && (
            <div className="absolute right-0 mt-2 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-pop">
              {[
                { href: "/customers/new", label: "Customer", icon: Building2 },
                { href: "/leads/new", label: "Lead", icon: Magnet },
                { href: "/tasks/new", label: "Task", icon: ListChecks },
              ].map((i) => (
                <Link
                  key={i.href}
                  href={i.href}
                  onClick={() => setCreateOpen(false)}
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-brand-50 hover:text-brand-700"
                >
                  <i.icon className="h-4 w-4" />
                  New {i.label.toLowerCase()}
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="relative" ref={userRef}>
          <button
            onClick={() => setUserOpen((o) => !o)}
            className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 hover:bg-slate-100"
          >
            <Avatar name={name} />
            <span className="hidden max-w-[140px] truncate text-sm font-medium text-slate-700 md:inline">{name}</span>
            <ChevronDown className="h-4 w-4 text-slate-400" />
          </button>
          {userOpen && (
            <div className="absolute right-0 mt-2 w-60 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-pop">
              <div className="border-b border-slate-100 px-4 py-3">
                <div className="truncate text-sm font-semibold text-slate-900">{name}</div>
                <div className="truncate text-xs text-slate-500">{email}</div>
              </div>
              <div className="p-1">
                <Link
                  href="/profile"
                  onClick={() => setUserOpen(false)}
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <UserRound className="h-4 w-4" /> My profile
                </Link>
                <button
                  onClick={signOut}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-rose-600 hover:bg-rose-50"
                >
                  <LogOut className="h-4 w-4" /> Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
