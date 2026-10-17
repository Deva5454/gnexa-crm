import { chunks } from "@/lib/fetch-all";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

type DB = SupabaseClient<Database>;
export type Balance = { paid: number; credited: number; credit_used: number; balance: number; refunded?: number };

/** Paid / credited / balance for a set of documents, keyed by id. */
export async function balancesFor(supabase: DB, ids: number[]) {
  const map = new Map<number, Balance>();
  if (!ids.length) return map;
  // In batches: thousands of ids in one `in=(…)` filter would overflow the request URL
  const results = await Promise.all(chunks([...new Set(ids)]).map((part) => supabase.from("doc_balances").select("*").in("id", part)));
  for (const b of results.flatMap((r) => r.data ?? [])) map.set(b.id, { paid: Number(b.paid), credited: Number(b.credited), credit_used: Number(b.credit_used), balance: Number(b.balance), refunded: Number(b.refunded ?? 0) });
  return map;
}

export async function companySettings(supabase: DB) {
  const { data } = await supabase.from("company_settings").select("*").maybeSingle();
  return data;
}

/** Payment modes marked "show on invoice" (Setup → Finance), printed as payment instructions on invoices. */
export async function invoicePayOptions(supabase: DB) {
  const { data } = await supabase.from("payment_modes").select("name, description").eq("is_active", true).eq("show_on_invoice", true).neq("applies_to", "expenses").order("is_default", { ascending: false }).order("id");
  return (data ?? []).map((m) => ({ name: m.name, description: m.description }));
}

/** The base currency all cross-document totals are shown in (Setup → Currencies), e.g. "INR". */
export async function baseCurrency(supabase: DB) {
  const { data } = await supabase.from("currencies").select("code").eq("is_base", true).maybeSingle();
  if (data?.code) return data.code;
  const { data: cs } = await supabase.from("company_settings").select("currency").maybeSingle();
  return cs?.currency ?? "INR";
}

/** An amount in a document's currency, in the base currency (rate frozen on the document). */
export const toBase = (amount: number, rate: number | null | undefined) => Math.round(amount * Number(rate ?? 1) * 100) / 100;
