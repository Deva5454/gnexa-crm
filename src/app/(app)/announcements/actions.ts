"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { str } from "@/lib/utils";

export type FormState = { error?: string; ok?: string } | undefined;

export async function postAnnouncement(_: FormState, form: FormData): Promise<FormState> {
  const { supabase } = await requireAdmin();
  const title = str(form, "title");
  const body = str(form, "body");
  const staff = form.get("show_to_staff") === "on";
  const clients = form.get("show_to_clients") === "on";
  if (!title || !body) return { error: "Title and message are required." };
  if (!staff && !clients) return { error: "Choose who should see it." };
  const { error } = await supabase.from("announcements").insert({ title, body, show_to_staff: staff, show_to_clients: clients });
  if (error) return { error: error.message };
  revalidatePath("/announcements");
  revalidatePath("/dashboard");
  revalidatePath("/portal");
  return { ok: "Posted." };
}

export async function deleteAnnouncement(form: FormData) {
  const { supabase } = await requireAdmin();
  await supabase.from("announcements").delete().eq("id", Number(str(form, "id")));
  revalidatePath("/announcements");
  revalidatePath("/dashboard");
}
