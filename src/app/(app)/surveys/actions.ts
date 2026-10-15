"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { str } from "@/lib/utils";

const TYPES = ["short", "long", "single", "multiple", "rating"];

export async function createSurvey(form: FormData) {
  const { supabase } = await requireStaff();
  const title = str(form, "title");
  if (!title) return;
  const { data } = await supabase.from("surveys").insert({ title: title.slice(0, 160), description: str(form, "description") }).select("id").single();
  revalidatePath("/surveys");
  if (data) redirect(`/surveys/${data.id}`);
}

export async function updateSurvey(form: FormData) {
  const { supabase } = await requireStaff();
  const id = Number(str(form, "id"));
  const title = str(form, "title");
  if (!title) return;
  await supabase
    .from("surveys")
    .update({ title: title.slice(0, 160), description: str(form, "description"), thank_you: str(form, "thank_you") ?? "Thanks for your feedback!", is_active: form.get("is_active") === "on" })
    .eq("id", id);
  revalidatePath(`/surveys/${id}`);
  revalidatePath("/surveys");
}

export async function deleteSurvey(form: FormData) {
  const { supabase } = await requireStaff();
  await supabase.from("surveys").delete().eq("id", Number(str(form, "id")));
  revalidatePath("/surveys");
  redirect("/surveys");
}

export async function saveQuestion(form: FormData) {
  const { supabase } = await requireStaff();
  const id = Number(str(form, "id"));
  const surveyId = Number(str(form, "survey_id"));
  const label = str(form, "label");
  const type = str(form, "type") ?? "short";
  if (!label || !TYPES.includes(type)) return;
  const options = (str(form, "options") ?? "").split(/[\n,]/).map((o) => o.trim()).filter(Boolean).slice(0, 20);
  const patch = { label: label.slice(0, 300), type, options: type === "single" || type === "multiple" ? options : [], required: form.get("required") === "on" };
  if (id) await supabase.from("survey_questions").update(patch).eq("id", id);
  else {
    const { count } = await supabase.from("survey_questions").select("id", { count: "exact", head: true }).eq("survey_id", surveyId);
    await supabase.from("survey_questions").insert({ ...patch, survey_id: surveyId, position: (count ?? 0) + 1 });
  }
  revalidatePath(`/surveys/${surveyId}`);
}

export async function deleteQuestion(form: FormData) {
  const { supabase } = await requireStaff();
  const { data } = await supabase.from("survey_questions").delete().eq("id", Number(str(form, "id"))).select("survey_id").single();
  if (data) revalidatePath(`/surveys/${data.survey_id}`);
}
