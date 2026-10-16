import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { readMenuConfig } from "@/components/layout/nav";
import { allows, MODULES, resolveAccess, type Level, type Module } from "@/lib/permissions";

/** Is this install the public demo? Only the owner can switch it off (private.go_live). Cached per request. */
export const isDemoMode = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("demo_mode");
  return data !== false;
});

/** Where someone without a usable session goes: the demo picks a persona, a live CRM asks to sign in. */
async function signInUrl(next?: string, as?: string) {
  if (await isDemoMode()) return `/demo?${as ? `as=${as}&` : ""}${next ? `next=${encodeURIComponent(next)}` : ""}`;
  return `/login${next ? `?next=${encodeURIComponent(next)}` : ""}`;
}

/** Current signed-in, active staff member with their role's access. Cached per request. */
export const requireStaff = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(await signInUrl());

  const [{ data }, { data: cs }] = await Promise.all([
    supabase.from("profiles").select("*, role:roles(name, permissions)").eq("id", user.id).maybeSingle(),
    supabase.from("company_settings").select("theme, disabled_modules, menu_config").maybeSingle(),
  ]);
  if (!data) {
    // Client-portal accounts have no staff profile
    const { data: portal } = await supabase.from("portal_users").select("user_id").eq("user_id", user.id).maybeSingle();
    if (portal) redirect("/portal");
  }
  // A deactivated or unknown account is signed out — never quietly swapped for another account
  if (!data || !data.is_active) {
    await supabase.auth.signOut();
    redirect("/login?error=inactive");
  }
  const { role, ...profile } = data;
  // Setup → Modules: a switched-off module is off for everyone, admins included
  const disabled = cs?.disabled_modules ?? [];
  const access = resolveAccess(profile.is_admin, role?.permissions);
  for (const m of MODULES) if (disabled.includes(m)) access[m] = "none";
  const featureOn = (f: string) => !disabled.includes(f);
  const settings = { theme: cs?.theme ?? "violet", disabled, menu: readMenuConfig(cs?.menu_config) };
  const roleName = profile.is_admin ? "Administrator" : (role?.name ?? "Staff");
  const can = (module: Module, level: Level) => allows(access, module, level);
  return { supabase, user, profile, access, roleName, can, featureOn, settings };
});

/** Admin-only pages and actions. Others get the standard "Not found" page (a redirect here tripped React in production). */
export async function requireAdmin() {
  const ctx = await requireStaff();
  if (!ctx.profile.is_admin) notFound();
  return ctx;
}

/** Page guard: bounce to `fallback` when the current role lacks the level. */
export async function requireAccess(module: Module, level: Level, fallback: string) {
  const ctx = await requireStaff();
  if (!ctx.can(module, level)) redirect(fallback);
  return ctx;
}

/** Page guard for features that can be switched off in Setup → Modules (newsfeed, surveys, media…). */
export async function requireFeature(feature: string) {
  const ctx = await requireStaff();
  if (!ctx.featureOn(feature)) notFound();
  return ctx;
}

/** Server-action guard: throws a readable error the error boundary shows. */
export async function assertAccess(module: Module, level: Level) {
  const ctx = await requireStaff();
  if (!ctx.can(module, level)) {
    const verb = level === "full" ? "delete" : level === "edit" ? "change" : "view";
    throw new Error(`The ${ctx.roleName} role can't ${verb} ${module}.`);
  }
  return ctx;
}

export function denied(roleName: string, module: Module, level: Level) {
  const verb = level === "full" ? "delete" : level === "edit" ? "create or change" : "view";
  return { error: `The ${roleName} role can't ${verb} ${module}.` };
}

/** Current client-portal user with their customer and contact. Staff are sent to the CRM. */
export const requirePortal = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(await signInUrl("/portal", "client-tata"));
  const { data: pu } = await supabase
    .from("portal_users")
    .select("customer_id, contact_id, customer:customers(id, company), contact:contacts(first_name, last_name, email)")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!pu?.customer) redirect("/dashboard");
  const contactName = pu.contact ? [pu.contact.first_name, pu.contact.last_name].filter(Boolean).join(" ") : (user.email ?? "Client");
  return { supabase, user, customerId: pu.customer_id, company: pu.customer.company, contactName, email: pu.contact?.email ?? user.email ?? "" };
});
