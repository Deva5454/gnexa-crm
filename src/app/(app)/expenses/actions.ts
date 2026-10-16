"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logActivity } from "@/lib/activity";
import { assertAccess, denied, requireStaff } from "@/lib/auth";
import { addInterval, computeTotals, docHref, docNumber } from "@/lib/sales";
import { num, str } from "@/lib/utils";
import { friendlyError, must, withFlash } from "@/lib/flash";
import { daysFromToday, todayIST } from "@/lib/dates";

export type FormState = { error?: string } | undefined;

const RECEIPTS = "expense-receipts";

/** Called after the browser uploaded a receipt straight to storage. Replaces any previous receipt. */
export async function recordReceipt(id: number, path: string, name: string): Promise<{ error?: string }> {
  const { supabase, can, roleName } = await requireStaff();
  if (!can("expenses", "edit")) return denied(roleName, "expenses", "edit");
  if (!path.startsWith(`${id}/`)) return { error: "Invalid file path." };
  const { data: old } = await supabase.from("expenses").select("receipt_path").eq("id", id).single();
  const { error } = await supabase.from("expenses").update({ receipt_path: path, receipt_name: name.slice(0, 200) }).eq("id", id);
  if (error) {
    await supabase.storage.from(RECEIPTS).remove([path]);
    return { error: friendlyError(error.message) };
  }
  if (old?.receipt_path && old.receipt_path !== path) await supabase.storage.from(RECEIPTS).remove([old.receipt_path]);
  revalidatePath(`/expenses/${id}`);
  revalidatePath("/expenses");
  return {};
}

export async function removeReceipt(form: FormData) {
  return withFlash(async () => {
    const { supabase } = await assertAccess("expenses", "edit");
    const id = Number(str(form, "id"));
    const { data: e } = await supabase.from("expenses").select("receipt_path").eq("id", id).single();
    if (e?.receipt_path) await supabase.storage.from(RECEIPTS).remove([e.receipt_path]);
    must(await supabase.from("expenses").update({ receipt_path: null, receipt_name: null }).eq("id", id));
    revalidatePath(`/expenses/${id}`);
  });
}

function fields(form: FormData) {
  return {
    name: str(form, "name") ?? "",
    category_id: num(form, "category_id"),
    amount: num(form, "amount") ?? -1,
    tax_rate: num(form, "tax_rate") ?? 0,
    date: str(form, "date") ?? todayIST(),
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
  if (id) {
    const { data: cur } = await supabase.from("expenses").select("invoice_id, customer_id").eq("id", id).single();
    if (cur?.invoice_id && (cur.customer_id !== f.customer_id || !f.is_billable))
      return { error: "This expense is already billed — remove it from the invoice first to change its customer or billing." };
  }
  // Recurring: next copy = date + (copies made + 1) intervals
  const every = Math.round(num(form, "recurring_every") ?? 0);
  const unit = ["week", "month", "year"].includes(str(form, "recurring_unit") ?? "") ? str(form, "recurring_unit")! : "month";
  const cycles = Math.round(num(form, "recurring_cycles") ?? 0) || null;
  const done = id && every ? ((await supabase.from("expenses").select("recurring_done").eq("id", id).single()).data?.recurring_done ?? 0) : 0;
  if (cycles != null && every && cycles < done) return { error: `${done} copies already exist — “stop after” can't be lower than that.` };
  const recurring =
    every > 0 && every <= 36
      ? { recurring_every: every, recurring_unit: unit, recurring_cycles: cycles, next_recurring_date: cycles != null && done >= cycles ? null : addInterval(f.date, every * (done + 1), unit) }
      : { recurring_every: null, recurring_cycles: null, next_recurring_date: null };
  const { data: saved, error } = id
    ? await supabase.from("expenses").update({ ...f, ...recurring }).eq("id", id).select("id").single()
    : await supabase.from("expenses").insert({ ...f, ...recurring }).select("id").single();
  if (error) return { error: friendlyError(error.message) };
  if (every) await supabase.rpc("run_recurring");
  revalidatePath("/expenses");
  redirect(`/expenses/${saved.id}`);
}

export async function deleteExpense(form: FormData) {
  return withFlash(async () => {
    const { supabase } = await assertAccess("expenses", "full");
    const { data: e } = await supabase.from("expenses").select("receipt_path").eq("id", Number(str(form, "id"))).maybeSingle();
    if (e?.receipt_path) await supabase.storage.from(RECEIPTS).remove([e.receipt_path]);
    must(await supabase.from("expenses").delete().eq("id", Number(str(form, "id"))));
    revalidatePath("/expenses");
    redirect("/expenses");
  });
}

/** Bill a billable expense to its customer as a new draft invoice. */
export async function invoiceExpense(form: FormData) {
  return withFlash(async () => {
    await assertAccess("sales", "edit");
    const { supabase } = await assertAccess("expenses", "edit");
    const id = Number(str(form, "id"));
    const { data: e } = await supabase.from("expenses").select("*, category:expense_categories(name)").eq("id", id).single();
    if (!e) throw new Error("Expense not found.");
    if (!e.customer_id) throw new Error("Assign a customer to this expense first.");
    if (e.invoice_id) redirect(docHref("invoice", e.invoice_id));

    if (!e.is_billable) throw new Error("Mark the expense as billable first.");

    const line = { description: e.name, long_description: [e.category?.name, e.reference].filter(Boolean).join(" · ") || null, qty: 1, rate: Number(e.amount), tax_rate: Number(e.tax_rate), expense_id: id };
    const t = computeTotals([line], 0, 0);
    const { data: settings } = await supabase.from("company_settings").select("currency, default_terms").maybeSingle();
    // One transaction: if the expense was billed meanwhile (e.g. a double click), nothing is created
    const { data: saved, error } = await supabase.rpc("save_sales_doc", {
      p_kind: "invoice",
      p_id: null,
      p_doc: {
        customer_id: e.customer_id,
        subject: `Reimbursable expense — ${e.name}`,
        date: todayIST(),
        due_date: daysFromToday(15),
        currency: settings?.currency ?? "INR",
        ...t,
        terms: settings?.default_terms ?? null,
      },
      p_lines: [line],
    });
    if (error) {
      const { data: now } = await supabase.from("expenses").select("invoice_id").eq("id", id).single();
      if (now?.invoice_id) redirect(docHref("invoice", now.invoice_id)); // billed by a click that got there first
      throw new Error(error.message);
    }
    const inv = saved as { id: number; number: number };
    await logActivity(supabase, `billed expense “${e.name}” on ${docNumber("invoice", inv.number)}`, { type: "customer", id: e.customer_id });
    revalidatePath("/expenses");
    redirect(docHref("invoice", inv.id));
  });
}
