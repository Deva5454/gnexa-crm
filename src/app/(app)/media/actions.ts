"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { discardUpload, fileRow } from "@/lib/uploads";

const BUCKET = "media";

export async function recordMedia(input: { folder: string; name: string; path: string; size: number; mime: string | null }): Promise<{ error?: string }> {
  const { supabase } = await requireStaff();
  const folder = String(input?.folder ?? "").trim().replace(/[\\/]+/g, "-").slice(0, 60) || "General";
  const row = fileRow(input);
  if (!row || !row.path.startsWith("lib/")) return { error: "Invalid file." };
  const { error } = await supabase.from("media_files").insert({ ...row, folder });
  if (error) {
    await discardUpload(supabase, BUCKET, "media_files", row.path);
    return { error: error.message };
  }
  revalidatePath("/media");
  return {};
}

export async function deleteMedia(form: FormData) {
  const { supabase, profile } = await requireStaff();
  const id = Number(form.get("id"));
  const { data: f } = await supabase.from("media_files").select("path, uploaded_by").eq("id", id).single();
  if (!f) return;
  if (f.uploaded_by !== profile.id && !profile.is_admin) throw new Error("Only the uploader or an admin can delete this file.");
  await supabase.storage.from(BUCKET).remove([f.path]);
  await supabase.from("media_files").delete().eq("id", id);
  revalidatePath("/media");
}

/** A link anyone can open for 7 days — for pasting into e-mails or chats. */
export async function shareLink(id: number): Promise<{ url?: string; error?: string }> {
  const { supabase } = await requireStaff();
  const { data: f } = await supabase.from("media_files").select("path").eq("id", id).single();
  if (!f) return { error: "File not found." };
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(f.path, 7 * 86400);
  if (error || !data) return { error: error?.message ?? "Could not create link." };
  return { url: data.signedUrl };
}
