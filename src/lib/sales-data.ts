import { chunks } from "@/lib/fetch-all";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

type DB = SupabaseClient<Database>;
export type Balance = { paid: number; credited: number; credit_used: number; balance: number };

/** Paid / credited / balance for a set of documents, keyed by id. */
export async function balancesFor(supabase: DB, ids: number[]) {
  const map = new Map<number, Balance>();
  if (!ids.length) return map;
  // In batches: thousands of ids in one `in=(…)` filter would overflow the request URL
  const results = await Promise.all(chunks([...new Set(ids)]).map((part) => supabase.from("doc_balances").select("*").in("id", part)));
  for (const b of results.flatMap((r) => r.data ?? [])) map.set(b.id, { paid: Number(b.paid), credited: Number(b.credited), credit_used: Number(b.credit_used), balance: Number(b.balance) });
  return map;
}

export async function companySettings(supabase: DB) {
  const { data } = await supabase.from("company_settings").select("*").maybeSingle();
  return data;
}
