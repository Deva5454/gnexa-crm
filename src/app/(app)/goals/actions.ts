"use server";

import { revalidatePath } from "next/cache";
import { assertAccess, denied, requireStaff } from "@/lib/auth";
import { GOAL_METRICS } from "@/lib/goals";
import { num, str } from "@/lib/utils";

export type FormState = { error?: string; ok?: string } | undefined;

export async function addGoal(_: FormState, form: FormData): Promise<FormState> {
  const { supabase, can, roleName } = await requireStaff();
  if (!can("reports", "edit")) return denied(roleName, "reports", "edit");
  const metric = str(form, "metric") ?? "";
  const fields = {
    title: str(form, "title") ?? "",
    metric,
    target: num(form, "target") ?? 0,
    start_date: str(form, "start_date") ?? "",
    end_date: str(form, "end_date") ?? "",
    staff_id: str(form, "staff_id"),
  };
  if (!fields.title) return { error: "Give the goal a title." };
  if (!GOAL_METRICS.some((m) => m.value === metric)) return { error: "Choose what to measure." };
  if (!(fields.target > 0)) return { error: "Target must be more than zero." };
  if (!fields.start_date || !fields.end_date || fields.end_date < fields.start_date) return { error: "Choose a valid period." };
  const { error } = await supabase.from("goals").insert(fields);
  if (error) return { error: error.message };
  revalidatePath("/goals");
  revalidatePath("/dashboard");
  return { ok: "Goal added." };
}

export async function deleteGoal(form: FormData) {
  const { supabase } = await assertAccess("reports", "full");
  await supabase.from("goals").delete().eq("id", Number(str(form, "id")));
  revalidatePath("/goals");
  revalidatePath("/dashboard");
}
