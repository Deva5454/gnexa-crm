"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";
import { NAV } from "./nav";
import type { Module } from "@/lib/permissions";

export function Sidebar({
  isAdmin,
  visible,
  mobileOpen,
  onClose,
}: {
  isAdmin: boolean;
  visible: Module[];
  mobileOpen: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("gnexa:rail") === "1");
    } catch {}
  }, []);

  const toggle = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem("gnexa:rail", c ? "0" : "1");
      } catch {}
      return !c;
    });
  };

  // On phones the closed menu is off-screen: keep it out of the tab order (inert) and close it with Escape
  const [desktop, setDesktop] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => setDesktop(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  useEffect(() => {
    if (!mobileOpen) return;
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [mobileOpen, onClose]);

  return (
    <>
      {mobileOpen && <div className="fixed inset-0 z-30 bg-ink-950/50 lg:hidden" onClick={onClose} />}
      <aside
        inert={!desktop && !mobileOpen}
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex flex-col bg-ink-900 text-slate-300 transition-all duration-200",
          "lg:sticky lg:top-0 lg:h-screen lg:translate-x-0",
          collapsed ? "lg:w-[72px]" : "lg:w-60",
          mobileOpen ? "w-64 translate-x-0" : "w-64 -translate-x-full",
        )}
      >
        <div className="relative flex h-16 items-center justify-between px-4">
          <Link href="/dashboard" onClick={onClose}>
            <Logo collapsed={collapsed} />
          </Link>
          <button onClick={onClose} className="rounded-md p-1 text-slate-400 hover:text-white lg:hidden" aria-label="Close menu">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mx-4 mb-2 h-px bg-gradient-to-r from-brand-500/40 via-accent-500/30 to-transparent" />

        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-3">
          {NAV.map((group) => {
            const items = group.items.filter((i) => (!i.adminOnly || isAdmin) && (!i.module || visible.includes(i.module)));
            if (!items.length) return null;
            return (
              <div key={group.section}>
                {!collapsed && (
                  <div className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    {group.section}
                  </div>
                )}
                <ul className="space-y-0.5">
                  {items.map((item) => {
                    const active = !item.soon && (pathname === item.href || pathname.startsWith(`${item.href}/`));
                    const Icon = item.icon;
                    const inner = (
                      <>
                        <Icon className={cn("h-[18px] w-[18px] shrink-0", active ? "text-white" : "text-slate-400 group-hover:text-slate-200")} />
                        {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                        {!collapsed && item.soon && (
                          <span className="rounded bg-ink-700 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-400">
                            Soon
                          </span>
                        )}
                      </>
                    );
                    const cls = cn(
                      "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      collapsed && "lg:justify-center lg:px-0",
                      active ? "bg-gradient-to-r from-brand-600/90 to-brand-500/60 text-white shadow-pop" : "hover:bg-ink-800 hover:text-white",
                      item.soon && "cursor-default opacity-60 hover:bg-transparent hover:text-slate-300",
                    );
                    return (
                      <li key={item.label}>
                        {item.soon ? (
                          <span className={cls} title={`${item.label} — coming soon`}>
                            {inner}
                          </span>
                        ) : (
                          <Link href={item.href} className={cls} onClick={onClose} title={collapsed ? item.label : undefined}>
                            {inner}
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>

        <button
          onClick={toggle}
          aria-label={collapsed ? "Expand menu" : "Collapse menu"}
          className="mx-3 mb-4 hidden items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium text-slate-400 hover:bg-ink-800 hover:text-white lg:flex"
        >
          {collapsed ? <PanelLeftOpen className="mx-auto h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          {!collapsed && "Collapse"}
        </button>
      </aside>
    </>
  );
}
