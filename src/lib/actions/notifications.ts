"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";

export type BellItem = { id: number; title: string; body: string | null; link: string | null; is_read: boolean; created_at: string; actor: string | null };

/** Turns due reminders into notifications, then returns the latest few + the unread count. */
export async function loadBell(): Promise<{ items: BellItem[]; unread: number }> {
  const { supabase, profile } = await requireStaff();
  await supabase.rpc("flush_reminders");
  const [{ data }, { count }] = await Promise.all([
    supabase
      .from("notifications")
      .select("id, title, body, link, is_read, created_at, actor:profiles!notifications_actor_id_fkey(full_name)")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", profile.id).eq("is_read", false),
  ]);
  return {
    items: (data ?? []).map((n) => ({ id: n.id, title: n.title, body: n.body, link: n.link, is_read: n.is_read, created_at: n.created_at, actor: n.actor?.full_name ?? null })),
    unread: count ?? 0,
  };
}

export async function markRead(id: number) {
  const { supabase } = await requireStaff();
  await supabase.from("notifications").update({ is_read: true }).eq("id", id);
  revalidatePath("/notifications");
}

export async function markAllRead() {
  const { supabase, profile } = await requireStaff();
  await supabase.from("notifications").update({ is_read: true }).eq("user_id", profile.id).eq("is_read", false);
  revalidatePath("/notifications");
}

export async function clearRead() {
  const { supabase, profile } = await requireStaff();
  await supabase.from("notifications").delete().eq("user_id", profile.id).eq("is_read", true);
  revalidatePath("/notifications");
}
