// The "Payment recorded" receipt e-mail (server-side helpers; not form actions)
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { renderTemplate } from "@/lib/email-templates";
import { friendlyError } from "@/lib/flash";
import { docNumber } from "@/lib/sales";
import { balancesFor, companySettings } from "@/lib/sales-data";
import { formatDate, formatMoney } from "@/lib/utils";

type DB = SupabaseClient<Database>;

/** The "Payment recorded" receipt e-mail for one payment, with who it can go to. */
export async function paymentReceipt(supabase: DB, paymentId: number) {
  const { data: p } = await supabase
    .from("payments")
    .select("id, amount, date, transaction_id, mode:payment_modes(name), invoice:sales_docs(id, number, currency, customer_id)")
    .eq("id", paymentId)
    .maybeSingle();
  if (!p?.invoice) return null;
  const inv = p.invoice;
  const [{ data: contacts }, company, bals] = await Promise.all([
    inv.customer_id
      ? supabase.from("contacts").select("email, first_name, last_name").eq("customer_id", inv.customer_id).not("email", "is", null).order("is_primary", { ascending: false })
      : Promise.resolve({ data: [] as { email: string | null; first_name: string; last_name: string | null }[] }),
    companySettings(supabase),
    balancesFor(supabase, [inv.id]),
  ]);
  const recipients = (contacts ?? []).map((c) => ({ email: c.email!, name: [c.first_name, c.last_name].filter(Boolean).join(" ") || null }));
  const tpl = await renderTemplate(supabase, "payment_recorded", {
    contact_name: (recipients[0]?.name ?? "").split(" ")[0] || "there",
    company_name: company?.company_name ?? "",
    doc_number: docNumber("invoice", inv.number),
    amount: formatMoney(Number(p.amount), inv.currency),
    date: formatDate(p.date),
    mode: p.mode?.name ?? "payment",
    reference: p.transaction_id ? `, ref ${p.transaction_id}` : "",
    balance: formatMoney(Math.max(0, bals.get(inv.id)?.balance ?? 0), inv.currency),
  });
  return { payment: p, invoice: inv, recipients, subject: tpl?.subject ?? `Payment receipt — ${docNumber("invoice", inv.number)}`, body: tpl?.body ?? "" };
}

/** Log the receipt e-mail (the demo never sends real mail). */
export async function logReceipt(supabase: DB, paymentId: number, to: { email: string; name: string | null }, subject: string, body: string) {
  const r = await paymentReceipt(supabase, paymentId);
  if (!r) return "Payment not found.";
  const { error } = await supabase.from("email_log").insert({
    customer_id: r.invoice.customer_id, to_email: to.email, to_name: to.name, subject, body, kind: "receipt", rel_type: "payment", rel_id: paymentId,
  });
  return error ? friendlyError(error.message) : null;
}
