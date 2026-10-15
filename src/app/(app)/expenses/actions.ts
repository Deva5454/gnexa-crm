"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logActivity } from "@/lib/activity";
import { assertAccess, denied, requireStaff } from "@/lib/auth";
import { computeTotals, docHref, docNumber } from "@/lib/sales";
import { num, str } from "@/lib/utils";

export type FormState = { error?: string } | undefined;

function fields(form: FormData) {
  return {
    name: str(form, "name") ?? "",
    category_id: num(form, "category_id"),
    amount: num(form, "amount") ?? -1,
    tax_rate: num(form, "tax_rate") ?? 0,
    date: str(form, "date") ?? new Date().toISOString().slice(0, 10),
    customer_id: num(form, "customer_id"),
    payment_mode_id: num(form, "payment_mode_id"),
    reference: str(form, "reference"),
    note: str(form, "note"),
    is_billable: form.get("is_billable") === "on",
  };
}

export async function saveExpense(id: number | null, _: FormState, form: FormData): Promise<FormState> {
  const { supabase, can, roleName } = await requireStaff();
  if (!can("expenses", "edit")) return denied(roleName, "expenses", "edit");
  const f = fields(form);
  if (!f.name) return { error: "Give the expense a name." };
  if (f.amount < 0) return { error: "Amount must be zero or more." };
  if (f.is_billable && !f.customer_id) return { error: "Billable expenses need a customer." };
  const { error } = id ? await supabase.from("expenses").update(f).eq("id", id) : await supabase.from("expenses").insert(f);
  if (error) return { error: error.message };
  revalidatePath("/expenses");
  redirect("/expenses");
}

export async function deleteExpense(form: FormData) {
  const { supabase } = await assertAccess("expenses", "full");
  await supabase.from("expenses").delete().eq("id", Number(str(form, "id")));
  revalidatePath("/expenses");
  redirect("/expenses");
}

/** Bill a billable expense to its customer as a new draft invoice. */
export async function invoiceExpense(form: FormData) {
  await assertAccess("sales", "edit");
  const { supabase } = await assertAccess("expenses", "edit");
  const id = Number(str(form, "id"));
  const { data: e } = await supabase.from("expenses").select("*, category:expense_categories(name)").eq("id", id).single();
  if (!e) throw new Error("Expense not found.");
  if (!e.customer_id) throw new Error("Assign a customer to this expense first.");
  if (e.invoice_id) redirect(docHref("invoice", e.invoice_id));

  const line = { description: e.name, long_description: [e.category?.name, e.reference].filter(Boolean).join(" · ") || null, qty: 1, rate: Number(e.amount), tax_rate: Number(e.tax_rate) };
  const t = computeTotals([line], 0, 0);
  const { data: settings } = await supabase.from("company_settings").select("currency, default_terms").maybeSingle();
  const { data: inv, error } = await supabase
    .from("sales_docs")
    .insert({
      kind: "invoice",
      customer_id: e.customer_id,
      subject: `Reimbursable expense — ${e.name}`,
      due_date: new Date(Date.now() + 15 * 86400_000).toISOString().slice(0, 10),
      currency: settings?.currency ?? "INR",
      subtotal: t.subtotal,
      discount_total: 0,
      tax_total: t.tax_total,
      total: t.total,
      terms: settings?.default_terms ?? null,
    })
    .select("id, number")
    .single();
  if (error) throw new Error(error.message);
  await supabase.from("sales_doc_items").insert({ ...line, doc_id: inv.id, position: 0 });
  await supabase.from("expenses").update({ invoice_id: inv.id }).eq("id", id);
  await logActivity(supabase, `billed expense “${e.name}” on ${docNumber("invoice", inv.number)}`, { type: "customer", id: e.customer_id });
  revalidatePath("/expenses");
  redirect(docHref("invoice", inv.id));
}
