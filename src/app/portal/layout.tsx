import type { Metadata } from "next";
import { Suspense } from "react";
import { LogoMark } from "@/components/layout/logo";
import { RoleSwitcher } from "@/components/layout/role-switcher";
import { isDemoMode, requirePortal } from "@/lib/auth";
import { personaByEmail } from "@/lib/demo";
import { PortalNav } from "./portal-nav";

export const metadata: Metadata = { title: { default: "Client portal", template: "%s · Client portal" } };

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user, company, contactName } = await requirePortal();
  const { data: settings } = await supabase.from("company_settings").select("company_name").maybeSingle();
  const demo = await isDemoMode();
  return (
    <div className="min-h-screen bg-canvas">
      <header className="bg-ink-900 print:hidden">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex h-16 items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <LogoMark className="h-9 w-9 shrink-0" />
              <div className="min-w-0 leading-tight">
                <div className="truncate text-sm font-semibold text-white">{settings?.company_name ?? "Gnexa"}</div>
                <div className="truncate text-xs text-slate-400">Client portal · {company}</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {demo && <span className="hidden rounded-full bg-accent-500/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-accent-400 sm:inline">Demo</span>}
              <Suspense>
                <RoleSwitcher name={contactName} roleName={company} personaKey={personaByEmail(user.email)?.key} demo={demo} />
              </Suspense>
            </div>
          </div>
          <PortalNav />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 print:max-w-none print:p-0">{children}</main>
    </div>
  );
}
