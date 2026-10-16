import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export type ReqStatus = { key: string; name: string; color: string; is_open: boolean };

const FALLBACK: ReqStatus = { key: "new", name: "New", color: "#0ea5e9", is_open: true };

/** Estimate request statuses (Setup → Estimate request → Statuses), in order, plus a lookup by key. */
export async function reqStatuses(supabase: SupabaseClient<Database>) {
  const { data } = await supabase.from("estimate_request_statuses").select("key, name, color, is_open").order("sort_order");
  const list: ReqStatus[] = data?.length ? data : [FALLBACK];
  const map = new Map(list.map((s) => [s.key, s]));
  return { list, of: (key: string) => map.get(key) ?? { ...FALLBACK, key, name: key } };
}
