"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertAccess, denied, requireStaff } from "@/lib/auth";
import { num, str } from "@/lib/utils";
import { friendlyError, must, withFlash } from "@/lib/flash";

export type FormState = { error?: string } | undefined;

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .slice(0, 80) || "article";

export async function saveArticle(id: number | null, _: FormState, form: FormData): Promise<FormState> {
  const { supabase, can, roleName } = await requireStaff();
  if (!can("knowledge_base", "edit")) return denied(roleName, "knowledge_base", "edit");
  const title = str(form, "title");
  const body = str(form, "body");
  if (!title) return { error: "Title is required." };
  if (!body) return { error: "Write the article body." };

  // Unique slug: append -2, -3… when taken by another article
  const base = slugify(str(form, "slug") ?? title);
  let slug = base;
  for (let n = 2; ; n++) {
    const { data } = await supabase.from("kb_articles").select("id").eq("slug", slug).maybeSingle();
    if (!data || data.id === id) break;
    slug = `${base}-${n}`;
  }
  const fields = {
    title,
    body,
    slug,
    group_id: num(form, "group_id"),
    is_published: form.get("is_published") === "on",
    is_internal: form.get("is_internal") === "on",
    position: Math.max(-999, Math.min(999, Math.round(num(form, "position") ?? 0))),
    updated_at: new Date().toISOString(),
  };
  const { error } = id ? await supabase.from("kb_articles").update(fields).eq("id", id) : await supabase.from("kb_articles").insert(fields);
  if (error) return { error: friendlyError(error.message) };
  revalidatePath("/knowledge-base");
  redirect(`/knowledge-base/${slug}`);
}

export async function deleteArticle(form: FormData) {
  return withFlash(async () => {
    const { supabase } = await assertAccess("knowledge_base", "full");
    must(await supabase.from("kb_articles").delete().eq("id", Number(str(form, "id"))));
    revalidatePath("/knowledge-base");
    redirect("/knowledge-base");
  });
}

export async function voteArticle(id: number, helpful: boolean) {
  return withFlash(async () => {
    const { supabase } = await requireStaff();
    await supabase.rpc("kb_track", { p_article: id, p_event: helpful ? "yes" : "no" });
  });
}

export async function trackView(id: number) {
  return withFlash(async () => {
    const { supabase } = await requireStaff();
    await supabase.rpc("kb_track", { p_article: id, p_event: "view" });
  });
}

/** Bulk actions from the article list. */
export async function bulkArticles(form: FormData) {
  return withFlash(async () => {
    const op = str(form, "op") ?? "";
    const ids = [...new Set(form.getAll("ids").map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, 500);
    if (!ids.length) throw new Error("Tick at least one article first.");
    const { supabase } = await assertAccess("knowledge_base", op === "delete" ? "full" : "edit");
    const set = (patch: { is_published?: boolean; is_internal?: boolean; group_id?: number | null }) => supabase.from("kb_articles").update(patch).in("id", ids);
    switch (op) {
      case "publish": must(await set({ is_published: true })); break;
      case "unpublish": must(await set({ is_published: false })); break;
      case "internal": must(await set({ is_internal: true })); break;
      case "public": must(await set({ is_internal: false })); break;
      case "group": must(await set({ group_id: num(form, "target") })); break;
      case "delete": must(await supabase.from("kb_articles").delete().in("id", ids)); break;
      default: throw new Error("Pick an action.");
    }
    revalidatePath("/knowledge-base");
  });
}
