"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { str } from "@/lib/utils";
import { must, withFlash } from "@/lib/flash";

const refresh = () => {
  revalidatePath("/todos");
  revalidatePath("/dashboard");
};

export async function addTodo(form: FormData) {
  return withFlash(async () => {
    const { supabase } = await requireStaff();
    const body = str(form, "body");
    if (!body) return;
    must(await supabase.from("todos").insert({ body: body.slice(0, 300) }));
    refresh();
  });
}

export async function toggleTodo(id: number, done: boolean) {
  return withFlash(async () => {
    const { supabase } = await requireStaff();
    must(await supabase.from("todos").update({ is_done: done, done_at: done ? new Date().toISOString() : null }).eq("id", id));
    refresh();
  });
}

export async function deleteTodo(id: number) {
  return withFlash(async () => {
    const { supabase } = await requireStaff();
    must(await supabase.from("todos").delete().eq("id", id));
    refresh();
  });
}

export async function clearDoneTodos() {
  return withFlash(async () => {
    const { supabase, profile } = await requireStaff();
    must(await supabase.from("todos").delete().eq("staff_id", profile.id).eq("is_done", true));
    refresh();
  });
}
