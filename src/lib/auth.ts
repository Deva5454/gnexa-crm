import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Current signed-in, active staff member. Redirects otherwise. Cached per request. */
export const requireStaff = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (!profile || !profile.is_active) redirect("/pending");
  return { supabase, user, profile };
});

export async function requireAdmin() {
  const ctx = await requireStaff();
  if (!ctx.profile.is_admin) redirect("/dashboard");
  return ctx;
}
