"use client";

import { Suspense, useState } from "react";
import type { MenuConfig } from "./nav";
import { Sidebar } from "./sidebar";
import { Topbar, type CreateRights } from "./topbar";
import type { Module } from "@/lib/permissions";

export function AppShell({
  name,
  roleName,
  personaKey,
  isAdmin,
  demo,
  disabled,
  menu,
  canCreate,
  visible,
  children,
}: {
  visible: Module[];
  name: string;
  roleName: string;
  personaKey?: string;
  isAdmin: boolean;
  demo: boolean;
  disabled: string[];
  menu: MenuConfig;
  canCreate: CreateRights;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div className="flex min-h-screen">
      <Suspense>
        <Sidebar isAdmin={isAdmin} visible={visible} disabled={disabled} menu={menu} mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      </Suspense>
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar name={name} roleName={roleName} personaKey={personaKey} demo={demo} canCreate={canCreate} onMenu={() => setMobileOpen(true)} />
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
