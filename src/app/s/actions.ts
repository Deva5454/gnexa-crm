"use server";

import { createClient } from "@/lib/supabase/server";

export type SurveyState = { error?: string; ok?: string } | undefined;

export async function submitSurvey(key: string, _: SurveyState, form: FormData): Promise<SurveyState> {
  const answers: Record<string, string | string[]> = {};
  for (const [k, v] of form.entries()) {
    const m = k.match(/^q_(\d+)$/);
    if (!m || typeof v !== "string") continue;
    const multi = form.getAll(k).filter((x): x is string => typeof x === "string");
    answers[m[1]!] = multi.length > 1 || form.get(`multi_${m[1]}`) ? multi : v;
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_survey", {
    p_key: key,
    p_name: (form.get("name") as string | null) ?? null,
    p_email: (form.get("email") as string | null) ?? null,
    p_answers: answers,
  });
  if (error) return { error: error.message };
  return { ok: data ?? "Thank you!" };
}
