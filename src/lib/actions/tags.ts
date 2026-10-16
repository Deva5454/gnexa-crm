"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, requireStaff } from "@/lib/auth";
import { TAG_TYPES, type TagType } from "@/lib/links";
import { str } from "@/lib/utils";
import { friendlyError, must, withFlash } from "@/lib/flash";

const PALETTE = ["#6d55f2", "#0d9488", "#e11d48", "#f59e0b", "#0ea5e9", "#16a34a", "#7c3aed", "#ea580c"];

/** Attach a tag (creating it if it's new) to a record. */
export async function addTag(relType: TagType, relId: number, name: string, path: string): Promise<{ error?: string }> {
  const { supabase } = await requireStaff();
  const clean = name.trim().replace(/\s+/g, " ").slice(0, 40);
  if (!TAG_TYPES.includes(relType) || !relId || !clean) return { error: "Enter a tag name." };
  let { data: tag } = await supabase.from("tags").select("id").ilike("name", clean.replace(/[%_\\]/g, "\\$&")).maybeSingle();
  if (!tag) {
    const { count } = await supabase.from("tags").select("id", { count: "exact", head: true });
    const { data, error } = await supabase.from("tags").insert({ name: clean, color: PALETTE[(count ?? 0) % PALETTE.length] }).select("id").single();
    if (error) return { error: friendlyError(error.message) };
    tag = data;
  }
  const { error } = await supabase.from("taggables").upsert({ tag_id: tag.id, rel_type: relType, rel_id: relId }, { ignoreDuplicates: true });
  if (error) return { error: friendlyError(error.message) };
  revalidatePath(path);
  return {};
}

export async function removeTag(relType: TagType, relId: number, tagId: number, path: string) {
  return withFlash(async () => {
    const { supabase } = await requireStaff();
    must(await supabase.from("taggables").delete().eq("tag_id", tagId).eq("rel_type", relType).eq("rel_id", relId));
    revalidatePath(path);
  });
}

// ── Settings → Tags ──
export async function saveTag(form: FormData) {
  return withFlash(async () => {
    const { supabase } = await requireAdmin();
    const id = Number(str(form, "id"));
    const name = str(form, "name");
    const color = str(form, "color");
    if (!name) return;
    const patch = { name: name.slice(0, 40), ...(color && /^#[0-9a-f]{6}$/i.test(color) ? { color } : {}) };
    if (id) must(await supabase.from("tags").update(patch).eq("id", id));
    else await supabase.from("tags").insert(patch);
    revalidatePath("/settings/tags");
  });
}

export async function deleteTag(form: FormData) {
  return withFlash(async () => {
    const { supabase } = await requireAdmin();
    must(await supabase.from("tags").delete().eq("id", Number(str(form, "id"))));
    revalidatePath("/settings/tags");
  });
}
