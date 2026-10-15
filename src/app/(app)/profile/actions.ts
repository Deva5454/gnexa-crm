"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { str } from "@/lib/utils";

export type ProfileState = { error?: string; ok?: string } | undefined;

export async function updateProfile(_: ProfileState, form: FormData): Promise<ProfileState> {
  const { supabase, profile } = await requireStaff();
  const fullName = str(form, "full_name");
  if (!fullName) return { error: "Name is required." };
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName, phone: str(form, "phone"), job_title: str(form, "job_title") })
    .eq("id", profile.id);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: "Profile updated." };
}
