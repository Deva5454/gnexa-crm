"use client";

import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { Building2, FileSignature, FolderKanban, LifeBuoy, ListChecks, Magnet, Menu, Plus, Receipt, ReceiptText, Search } from "lucide-react";
import { NotificationBell } from "./notification-bell";
import { RoleSwitcher } from "./role-switcher";

export type CreateRights = { customers: boolean; leads: boolean; tasks: boolean; sales: boolean; expenses: boolean; projects: boolean; support: boolean };

export function Topbar({
  name,
  roleName,
  personaKey,
  canCreate,
  onMenu,
}: {
  name: string;
  roleName: string;
  personaKey?: string;
  canCreate: CreateRights;
  onMenu: () => void;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const createRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (createRef.current && !createRef.current.contains(e.target as Node)) setCreateOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const createItems = [
    { href: "/customers/new", label: "Customer", icon: Building2, ok: canCreate.customers },
    { href: "/leads/new", label: "Lead", icon: Magnet, ok: canCreate.leads },
    { href: "/tasks/new", label: "Task", icon: ListChecks, ok: canCreate.tasks },
    { href: "/sales/invoices/new", label: "Invoice", icon: ReceiptText, ok: canCreate.sales },
    { href: "/sales/proposals/new", label: "Proposal", icon: FileSignature, ok: canCreate.sales },
    { href: "/expenses/new", label: "Expense", icon: Receipt, ok: canCreate.expenses },
    { href: "/projects/new", label: "Project", icon: FolderKanban, ok: canCreate.projects },
    { href: "/support/new", label: "Ticket", icon: LifeBuoy, ok: canCreate.support },
  ].filter((i) => i.ok);

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
        <span className="hidden rounded-full bg-accent-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-accent-600 xl:inline">
          Demo
        </span>
        <NotificationBell />
        {createItems.length > 0 && (
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
                {createItems.map((i) => (
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
        )}
        <Suspense>
          <RoleSwitcher name={name} roleName={roleName} personaKey={personaKey} />
        </Suspense>
      </div>
    </header>
  );
}
