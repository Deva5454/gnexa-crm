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

export async function changePassword(_: ProfileState, form: FormData): Promise<ProfileState> {
  const { supabase } = await requireStaff();
  const pw = str(form, "password");
  if (!pw || pw.length < 8) return { error: "Password must be at least 8 characters." };
  if (pw !== str(form, "confirm")) return { error: "Passwords don't match." };
  const { error } = await supabase.auth.updateUser({ password: pw });
  if (error) return { error: error.message };
  return { ok: "Password changed." };
}
