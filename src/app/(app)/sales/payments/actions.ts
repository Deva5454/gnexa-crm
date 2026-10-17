"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logActivity } from "@/lib/activity";
import { assertAccess, denied, requireStaff } from "@/lib/auth";
import { friendlyError, must, withFlash } from "@/lib/flash";
import { docHref, docNumber } from "@/lib/sales";
import { logReceipt } from "@/lib/payment-receipt";
import { formatMoney, num, str } from "@/lib/utils";

type FormState = { error?: string; ok?: string } | undefined;

export async function sendPaymentReceipt(_: FormState, form: FormData): Promise<FormState> {
  const { supabase, can, roleName } = await requireStaff();
  if (!can("sales", "edit")) return denied(roleName, "sales", "edit");
  const id = Number(str(form, "payment_id"));
  const to = str(form, "to");
  const subject = str(form, "subject");
  const body = str(form, "body");
  const [email, name] = (to ?? "").split("|");
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Choose who to send it to." };
  if (!subject || !body) return { error: "Subject and message are required." };
  const err = await logReceipt(supabase, id, { email, name: name || null }, subject, body);
  if (err) return { error: err };
  revalidatePath(`/sales/payments/${id}`);
  return { ok: `Logged as sent to ${email}. (Demo — no real e-mail goes out.)` };
}

export async function updatePayment(_: FormState, form: FormData): Promise<FormState> {
  const { supabase, can, roleName } = await requireStaff();
  if (!can("sales", "edit")) return denied(roleName, "sales", "edit");
  const id = Number(str(form, "id"));
  const amount = num(form, "amount");
  const date = str(form, "date");
  if (!amount || amount <= 0) return { error: "Enter an amount greater than zero." };
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Enter the payment date." };
  // The database refuses an amount above the invoice's balance (other payments and credits included)
  const { data, error } = await supabase
    .from("payments")
    .update({ amount, date, mode_id: num(form, "mode_id"), transaction_id: str(form, "transaction_id"), note: str(form, "note") })
    .eq("id", id)
    .select("invoice_id, invoice:sales_docs(number, customer_id, currency)")
    .maybeSingle();
  if (error) return { error: friendlyError(error.message) };
  if (!data) return { error: "Payment not found." };
  if (data.invoice?.customer_id)
    await logActivity(supabase, `edited a payment on ${docNumber("invoice", data.invoice.number)} (now ${formatMoney(amount, data.invoice.currency)})`, { type: "customer", id: data.invoice.customer_id });
  revalidatePath(`/sales/payments/${id}`);
  revalidatePath("/sales/payments");
  revalidatePath(docHref("invoice", data.invoice_id));
  return { ok: "Payment updated." };
}

export async function deletePaymentRecord(form: FormData) {
  // Redirect only once the delete succeeded; a failure stays on the payment page with a message
  const done = await withFlash(async () => {
    const { supabase } = await assertAccess("sales", "full");
    const id = Number(str(form, "id"));
    const { data } = must(await supabase.from("payments").delete().eq("id", id).select("invoice_id, amount, invoice:sales_docs(number, customer_id, currency)").maybeSingle());
    if (!data) throw new Error("Payment not found.");
    if (data.invoice?.customer_id)
      await logActivity(supabase, `deleted a payment of ${formatMoney(Number(data.amount), data.invoice.currency)} on ${docNumber("invoice", data.invoice.number)}`, { type: "customer", id: data.invoice.customer_id });
    revalidatePath("/sales/payments");
    revalidatePath(docHref("invoice", data.invoice_id));
    return true;
  });
  if (done) redirect("/sales/payments");
}
