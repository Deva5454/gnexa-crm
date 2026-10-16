"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { REMINDER_TYPES, type ReminderType } from "@/lib/links";
import { str } from "@/lib/utils";

export type ReminderState = { error?: string; ok?: string } | undefined;

export async function addReminder(_: ReminderState, form: FormData): Promise<ReminderState> {
  const { supabase, profile } = await requireStaff();
  const relType = str(form, "rel_type") as ReminderType | null;
  const relId = Number(str(form, "rel_id"));
  const description = str(form, "description");
  const date = str(form, "date");
  const time = str(form, "time") ?? "10:00";
  const tz = str(form, "tz_offset"); // minutes, from the browser (getTimezoneOffset)
  if (!relType || !REMINDER_TYPES.includes(relType) || !relId) return { error: "Missing record." };
  if (!description) return { error: "What should we remind you about?" };
  if (!date) return { error: "Pick a date." };
  // Build the instant from the browser's local date/time + its UTC offset
  const offset = Number(tz ?? -330);
  const utc = new Date(`${date}T${time}:00Z`).getTime() + offset * 60_000;
  if (!Number.isFinite(utc)) return { error: "Invalid date or time." };
  const { error } = await supabase.from("reminders").insert({
    rel_type: relType,
    rel_id: relId,
    description,
    remind_at: new Date(utc).toISOString(),
    // Only admins set reminders for colleagues (the database enforces the same)
    staff_id: profile.is_admin ? (str(form, "staff_id") ?? profile.id) : profile.id,
  });
  if (error) return { error: error.message };
  const path = str(form, "path");
  if (path) revalidatePath(path);
  return { ok: "Reminder set." };
}

export async function deleteReminder(form: FormData) {
  const { supabase } = await requireStaff();
  await supabase.from("reminders").delete().eq("id", Number(str(form, "id")));
  const path = str(form, "path");
  if (path) revalidatePath(path);
  revalidatePath("/todos");
}
