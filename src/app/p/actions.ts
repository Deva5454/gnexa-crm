"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type PublicState = { error?: string; ok?: string } | undefined;

const tokenOk = (t: string) => /^[0-9a-f-]{36}$/i.test(t);

/** Accept or decline through the public link (no sign-in; the token is the key). */
export async function respondPublic(_: PublicState, form: FormData): Promise<PublicState> {
  const token = String(form.get("token") ?? "");
  if (!tokenOk(token)) return { error: "This link isn't valid." };
  const accept = form.get("decision") === "accept";
  const name = String(form.get("name") ?? "").trim();
  if (accept && !name) return { error: "Type your full name to accept." };
  if (accept && form.get("agree") !== "on") return { error: "Tick the box to confirm you accept." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("public_doc_respond", { p_token: token, p_accept: accept, p_name: name || null });
  if (error) return { error: error.message };
  revalidatePath(`/p/${token}`);
  return { ok: accept ? "Thank you — we've received your acceptance and will be in touch shortly." : "Thanks for letting us know." };
}

export async function commentPublic(_: PublicState, form: FormData): Promise<PublicState> {
  const token = String(form.get("token") ?? "");
  if (!tokenOk(token)) return { error: "This link isn't valid." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("public_doc_comment", {
    p_token: token,
    p_name: String(form.get("name") ?? ""),
    p_body: String(form.get("body") ?? ""),
  });
  if (error) return { error: error.message };
  revalidatePath(`/p/${token}`);
  return { ok: "Comment posted." };
}
