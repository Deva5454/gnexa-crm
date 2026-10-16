"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { str } from "@/lib/utils";
import { must, withFlash } from "@/lib/flash";

const P = "/newsfeed";

export async function createPost(form: FormData) {
  return withFlash(async () => {
    const { supabase } = await requireStaff();
    const body = str(form, "body");
    if (!body) return;
    must(await supabase.from("posts").insert({ body: body.slice(0, 4000) }));
    revalidatePath(P);
  });
}

export async function deletePost(form: FormData) {
  return withFlash(async () => {
    const { supabase, profile } = await requireStaff();
    const id = Number(str(form, "id"));
    const { data: p } = await supabase.from("posts").select("created_by").eq("id", id).single();
    if (!p || (p.created_by !== profile.id && !profile.is_admin)) return;
    must(await supabase.from("posts").delete().eq("id", id));
    revalidatePath(P);
  });
}

export async function togglePin(form: FormData) {
  return withFlash(async () => {
    const { supabase, profile } = await requireStaff();
    if (!profile.is_admin) return;
    must(await supabase.from("posts").update({ pinned: str(form, "pin") === "1" }).eq("id", Number(str(form, "id"))));
    revalidatePath(P);
  });
}

export async function toggleLike(postId: number, like: boolean) {
  return withFlash(async () => {
    const { supabase, profile } = await requireStaff();
    if (like) must(await supabase.from("post_likes").upsert({ post_id: postId, staff_id: profile.id }, { ignoreDuplicates: true }));
    else await supabase.from("post_likes").delete().eq("post_id", postId).eq("staff_id", profile.id);
    revalidatePath(P);
  });
}

export async function addPostComment(form: FormData) {
  return withFlash(async () => {
    const { supabase } = await requireStaff();
    const body = str(form, "body");
    if (!body) return;
    must(await supabase.from("post_comments").insert({ post_id: Number(str(form, "post_id")), body: body.slice(0, 2000) }));
    revalidatePath(P);
  });
}

export async function deletePostComment(form: FormData) {
  return withFlash(async () => {
    const { supabase, profile } = await requireStaff();
    const id = Number(str(form, "id"));
    const { data: c } = await supabase.from("post_comments").select("created_by").eq("id", id).single();
    if (!c || (c.created_by !== profile.id && !profile.is_admin)) return;
    must(await supabase.from("post_comments").delete().eq("id", id));
    revalidatePath(P);
  });
}
