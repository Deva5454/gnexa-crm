"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { str } from "@/lib/utils";
import { friendlyError, must, withFlash } from "@/lib/flash";

export type FormState = { error?: string; ok?: string } | undefined;

export async function addEvent(_: FormState, form: FormData): Promise<FormState> {
  const { supabase } = await requireStaff();
  const title = str(form, "title");
  const date = str(form, "date");
  const allDay = form.get("all_day") === "on";
  const start = str(form, "start") ?? "09:00";
  const end = str(form, "end");
  if (!title || !date) return { error: "Title and date are required." };
  const startsAt = new Date(`${date}T${allDay ? "00:00" : start}:00+05:30`);
  const endsAt = !allDay && end ? new Date(`${date}T${end}:00+05:30`) : null;
  if (endsAt && endsAt < startsAt) return { error: "End time is before the start." };
  const { error } = await supabase.from("calendar_events").insert({
    title,
    description: str(form, "description"),
    starts_at: startsAt.toISOString(),
    ends_at: endsAt?.toISOString() ?? null,
    all_day: allDay,
    color: str(form, "color") ?? "#6d55f2",
  });
  if (error) return { error: friendlyError(error.message) };
  revalidatePath("/calendar");
  return { ok: "Event added." };
}

export async function deleteEvent(form: FormData) {
  return withFlash(async () => {
    const { supabase, profile } = await requireStaff();
    const id = Number(str(form, "id"));
    const { data } = await supabase.from("calendar_events").select("created_by").eq("id", id).single();
    if (data && (data.created_by === profile.id || profile.is_admin)) must(await supabase.from("calendar_events").delete().eq("id", id));
    revalidatePath("/calendar");
  });
}
