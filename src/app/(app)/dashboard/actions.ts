"use server";

import { revalidatePath } from "next/cache";
import { readDashboardConfig } from "@/components/dashboard/registry";
import { requireStaff } from "@/lib/auth";
import { must, withFlash } from "@/lib/flash";

/** Dashboard options: this person's widget order and hidden widgets. */
export async function saveDashboard(form: FormData) {
  return withFlash(async () => {
    const { supabase, profile } = await requireStaff();
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(String(form.get("layout") ?? "{}"));
    } catch {
      throw new Error("The dashboard layout could not be read.");
    }
    const cfg = readDashboardConfig(parsed); // keeps only known widget keys
    must(await supabase.from("profiles").update({ dashboard_config: cfg }).eq("id", profile.id));
    revalidatePath("/dashboard");
  });
}

export async function resetDashboard() {
  return withFlash(async () => {
    const { supabase, profile } = await requireStaff();
    must(await supabase.from("profiles").update({ dashboard_config: {} }).eq("id", profile.id));
    revalidatePath("/dashboard");
  });
}
