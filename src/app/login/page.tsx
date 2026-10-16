import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LogoMark } from "@/components/layout/logo";
import { Avatar } from "@/components/ui/avatar";
import { isDemoMode } from "@/lib/auth";
import { DEMO_PERSONAS } from "@/lib/demo";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  // Already signed in? Carry on (an inactive account is signed out before it's sent here)
  const { data: { user } } = await (await createClient()).auth.getUser();
  if (user && sp.error !== "inactive") redirect(sp.next && sp.next.startsWith("/") && !sp.next.startsWith("//") ? sp.next : "/dashboard");
  const demo = await isDemoMode();
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-3">
          <LogoMark className="h-10 w-10" />
          <span className="text-xl font-semibold text-slate-900">gnexa.crm</span>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="mb-1 text-lg font-semibold text-slate-900">Sign in</h1>
          <p className="mb-5 text-sm text-slate-500">Use the account your administrator set up for you.</p>
          {sp.error === "inactive" && (
            <p role="alert" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              That account isn&apos;t active. Ask an administrator to switch it on.
            </p>
          )}
          <LoginForm next={sp.next} />
        </div>
        {demo && (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Or try the demo as…</div>
            <ul className="grid gap-1 sm:grid-cols-2">
              {DEMO_PERSONAS.map((p) => (
                <li key={p.key}>
                  <a href={`/demo?as=${p.key}`} className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 hover:bg-slate-50">
                    <Avatar name={p.name} className="h-8 w-8" />
                    <span className="min-w-0 leading-tight">
                      <span className="block truncate text-sm font-semibold text-slate-800">{p.name}</span>
                      <span className="block truncate text-xs text-slate-500">{p.client ? "Client portal" : p.role}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
