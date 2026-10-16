"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { num, str } from "@/lib/utils";
import { must, withFlash } from "@/lib/flash";

const ALL = ["name", "email", "phone", "company", "budget", "message"];

export async function saveWebForm(form: FormData) {
  return withFlash(async () => {
    const { supabase } = await requireAdmin();
    const id = Number(str(form, "id"));
    const name = str(form, "name");
    if (!name) return;
    const kind = str(form, "kind") === "estimate_request" ? "estimate_request" : "lead";
    const fields = ["name", ...ALL.filter((f) => f !== "name" && form.get(`f_${f}`) === "on")];
    const required = ["name", ...fields.filter((f) => f !== "name" && form.get(`r_${f}`) === "on")];
    const patch = {
      name: name.slice(0, 120),
      intro: str(form, "intro"),
      fields,
      required,
      source_id: num(form, "source_id"),
      status_id: num(form, "status_id"),
      assigned_to: str(form, "assigned_to"),
      success_message: str(form, "success_message") ?? "Thank you! We will be in touch shortly.",
      is_active: id ? form.get("is_active") === "on" : true,
    };
    if (id) must(await supabase.from("web_forms").update(patch).eq("id", id));
    else await supabase.from("web_forms").insert({ ...patch, kind });
    revalidatePath("/settings/web-forms");
  });
}

export async function deleteWebForm(form: FormData) {
  return withFlash(async () => {
    const { supabase } = await requireAdmin();
    must(await supabase.from("web_forms").delete().eq("id", Number(str(form, "id"))));
    revalidatePath("/settings/web-forms");
  });
}
