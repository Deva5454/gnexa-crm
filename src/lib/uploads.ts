import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export type UploadInput = { name: string; path: string; size: number; mime: string | null };

/** Pick and validate the fields of a browser-uploaded file. Never trust the rest of the object. */
export function fileRow(input: UploadInput) {
  const name = String(input?.name ?? "").trim().slice(0, 200);
  const path = String(input?.path ?? "");
  const size = Number(input?.size);
  const mime = input?.mime == null ? null : String(input.mime);
  if (!name || !path || path.length > 400 || path.includes("..") || path.startsWith("/")) return null;
  if (!Number.isFinite(size) || size < 0) return null;
  if (mime !== null && !/^[\w.+-]+\/[\w.+-]+$/.test(mime)) return null;
  return { name, path, size: Math.round(size), mime };
}

/**
 * Remove a just-uploaded object after its record failed to save — but only if no record already
 * points at that path (otherwise the failure was a clash with someone else's file, which must stay).
 * Storage policies also only let people remove objects they uploaded.
 */
export async function discardUpload(
  supabase: SupabaseClient<Database>,
  bucket: string,
  table: "media_files" | "project_files" | "task_files" | "lead_files" | "customer_files" | "sales_doc_files" | "ticket_files" | "contract_files",
  path: string,
) {
  const { data } = await supabase.from(table).select("id").eq("path", path).maybeSingle();
  if (!data) await supabase.storage.from(bucket).remove([path]);
}
