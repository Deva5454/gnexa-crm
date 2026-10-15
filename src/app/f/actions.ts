"use server";

import { createClient } from "@/lib/supabase/server";

export type PublicState = { error?: string; ok?: string } | undefined;

const FIELDS = ["name", "email", "phone", "company", "budget", "message", "website"] as const;

export async function submitPublicForm(key: string, _: PublicState, form: FormData): Promise<PublicState> {
  const data: Record<string, string> = {};
  for (const f of FIELDS) {
    const v = form.get(f);
    if (typeof v === "string") data[f] = v.slice(0, 4000);
  }
  const supabase = await createClient();
  const { data: msg, error } = await supabase.rpc("submit_web_form", { p_key: key, p_data: data });
  if (error) return { error: error.message };
  return { ok: msg ?? "Thank you!" };
}
