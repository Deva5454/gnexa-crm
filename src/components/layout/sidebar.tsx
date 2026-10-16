"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronDown, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";
import { arrange, NAV, type MenuConfig, type NavItem } from "./nav";
import type { Module } from "@/lib/permissions";

export function Sidebar({
  isAdmin,
  visible,
  disabled,
  menu,
  mobileOpen,
  onClose,
}: {
  isAdmin: boolean;
  visible: Module[];
  /** features switched off in Setup → Modules */
  disabled: string[];
  /** Setup → Menu setup */
  menu: MenuConfig;
  mobileOpen: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const params = useSearchParams();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const allowed = (i: NavItem) =>
    (!i.adminOnly || isAdmin) && (!i.module || visible.includes(i.module)) && (!i.feature || !disabled.includes(i.feature));
  const isActive = (i: NavItem) => {
    const [path, qs] = i.href.split("?");
    if (qs) {
      const want = new URLSearchParams(qs);
      return pathname === path && [...want].every(([k, v]) => (params.get(k) ?? (k === "tab" ? "sales" : null)) === v);
    }
    return pathname === path || pathname.startsWith(`${path}/`);
  };
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

        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-3" aria-label="Main">
          {NAV.map((group) => {
            const items = arrange(group.items, group.section, menu)
              .map((i) => (i.children ? { ...i, children: arrange(i.children.filter(allowed), i.href, menu) } : i))
              .filter((i) => allowed(i) && (!i.children || i.children.length > 0));
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
                    const Icon = item.icon;
                    if (item.children) {
                      const childActive = item.children.some(isActive);
                      const open = (openGroups[item.href] ?? childActive) && !collapsed;
                      return (
                        <li key={item.label}>
                          <button
                            type="button"
                            onClick={() => {
                              if (collapsed) toggle();
                              setOpenGroups((g) => ({ ...g, [item.href]: !open }));
                            }}
                            aria-expanded={open}
                            title={collapsed ? item.label : undefined}
                            className={cn(
                              "group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-ink-800 hover:text-white",
                              collapsed && "lg:justify-center lg:px-0",
                              childActive && !open && "text-white",
                            )}
                          >
                            <Icon className={cn("h-[18px] w-[18px] shrink-0", childActive ? "text-white" : "text-slate-400 group-hover:text-slate-200")} />
                            {!collapsed && <span className="flex-1 truncate text-left">{item.label}</span>}
                            {!collapsed && <ChevronDown className={cn("h-4 w-4 text-slate-500 transition-transform", open && "rotate-180")} />}
                          </button>
                          {open && (
                            <ul className="mb-1 ml-5 mt-0.5 space-y-0.5 border-l border-ink-700 pl-3">
                              {item.children.map((c) => {
                                const active = isActive(c);
                                return (
                                  <li key={c.href}>
                                    <Link
                                      href={c.href}
                                      onClick={onClose}
                                      aria-current={active ? "page" : undefined}
                                      className={cn(
                                        "block truncate rounded-md px-2.5 py-1.5 text-[13px] transition-colors",
                                        active ? "bg-brand-600/80 font-medium text-white" : "text-slate-400 hover:bg-ink-800 hover:text-white",
                                      )}
                                    >
                                      {c.label}
                                    </Link>
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </li>
                      );
                    }
                    const active = !item.soon && isActive(item);
                    const inner = (
                      <>
                        <Icon className={cn("h-[18px] w-[18px] shrink-0", active ? "text-white" : "text-slate-400 group-hover:text-slate-200")} />
                        {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                      </>
                    );
                    const cls = cn(
                      "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      collapsed && "lg:justify-center lg:px-0",
                      active ? "bg-gradient-to-r from-brand-600/90 to-brand-500/60 text-white shadow-pop" : "hover:bg-ink-800 hover:text-white",
                    );
                    return (
                      <li key={item.label}>
                        <Link href={item.href} className={cls} onClick={onClose} title={collapsed ? item.label : undefined} aria-current={active ? "page" : undefined}>
                          {inner}
                        </Link>
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
