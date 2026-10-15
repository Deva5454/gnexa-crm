import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { docHref, docNumber } from "@/lib/sales";

export type StatementRow = { date: string; type: "invoice" | "payment" | "credit_note"; ref: string; href: string; detail: string; debit: number; credit: number; balance: number };
export type Statement = { from: string; to: string; opening: number; rows: StatementRow[]; invoiced: number; received: number; closing: number; currency: string };

/** Customer account statement: invoices are debits; payments and credit notes are credits. */
export async function buildStatement(supabase: SupabaseClient<Database>, customerId: number, from: string, to: string): Promise<Statement> {
  const { data: docs } = await supabase
    .from("sales_docs")
    .select("id, kind, number, date, subject, total, currency, status")
    .eq("customer_id", customerId)
    .in("kind", ["invoice", "credit_note"])
    .not("status", "in", "(draft,cancelled)")
    .lte("date", to);
  const invIds = (docs ?? []).filter((d) => d.kind === "invoice").map((d) => d.id);
  const { data: pays } = invIds.length
    ? await supabase.from("payments").select("id, invoice_id, amount, date, transaction_id, mode:payment_modes(name)").in("invoice_id", invIds).lte("date", to)
    : { data: [] };

  const entries: Omit<StatementRow, "balance">[] = [];
  for (const d of docs ?? []) {
    const label = docNumber(d.kind, d.number);
    if (d.kind === "invoice") entries.push({ date: d.date, type: "invoice", ref: label, href: docHref("invoice", d.id), detail: d.subject ?? "Invoice", debit: Number(d.total), credit: 0 });
    else entries.push({ date: d.date, type: "credit_note", ref: label, href: docHref("credit_note", d.id), detail: d.subject ?? "Credit note", debit: 0, credit: Number(d.total) });
  }
  for (const p of pays ?? []) {
    const inv = docs?.find((d) => d.id === p.invoice_id);
    entries.push({
      date: p.date,
      type: "payment",
      ref: p.transaction_id ?? `PAY-${p.id}`,
      href: docHref("invoice", p.invoice_id),
      detail: `Payment${p.mode?.name ? ` · ${p.mode.name}` : ""}${inv ? ` for ${docNumber("invoice", inv.number)}` : ""}`,
      debit: 0,
      credit: Number(p.amount),
    });
  }
  const order = { invoice: 0, credit_note: 1, payment: 2 } as const;
  entries.sort((a, b) => a.date.localeCompare(b.date) || order[a.type] - order[b.type]);

  const before = entries.filter((e) => e.date < from);
  const opening = before.reduce((s, e) => s + e.debit - e.credit, 0);
  let running = opening;
  const rows = entries
    .filter((e) => e.date >= from)
    .map((e) => {
      running += e.debit - e.credit;
      return { ...e, balance: Math.round(running * 100) / 100 };
    });
  return {
    from,
    to,
    opening: Math.round(opening * 100) / 100,
    rows,
    invoiced: rows.reduce((s, r) => s + r.debit, 0),
    received: rows.reduce((s, r) => s + r.credit, 0),
    closing: Math.round(running * 100) / 100,
    currency: docs?.[0]?.currency ?? "INR",
  };
}

/** Default range: start of the financial year (1 April) to today. */
export function defaultRange(today = new Date()) {
  const y = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
  return { from: `${y}-04-01`, to: today.toISOString().slice(0, 10) };
}
