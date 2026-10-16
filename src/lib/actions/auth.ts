"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { str } from "@/lib/utils";

export type SignInState = { error?: string } | undefined;

export async function signIn(_: SignInState, form: FormData): Promise<SignInState> {
  const email = str(form, "email");
  const password = String(form.get("password") ?? "");
  if (!email || !password) return { error: "Enter your e-mail and password." };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: /banned/i.test(error.message) ? "This account has been switched off." : "Wrong e-mail or password." };
  const next = str(form, "next");
  redirect(next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/login") ? next : "/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
