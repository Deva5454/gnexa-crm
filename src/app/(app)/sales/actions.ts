"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logActivity } from "@/lib/activity";
import { assertAccess, denied, requireStaff } from "@/lib/auth";
import { addInterval, computeTotals, docHref, docNumber, KINDS, type DocKind, type Line } from "@/lib/sales";
import { balancesFor } from "@/lib/sales-data";
import { num, str } from "@/lib/utils";

export type FormState = { error?: string; ok?: string } | undefined;

/** Expenses on invoice lines must be billable, for this customer, and not billed on another invoice. */
async function checkExpenses(lines: Line[], customerId: number | null, docId: number): Promise<{ ok: number[] } | { error: string }> {
  const ids = [...new Set(lines.map((l) => l.expense_id).filter((x): x is number => !!x))];
  if (!ids.length) return { ok: [] };
  const { supabase } = await requireStaff();
  const { data: exps } = await supabase.from("expenses").select("id, name, customer_id, is_billable, invoice_id").in("id", ids);
  for (const id of ids) {
    const e = exps?.find((x) => x.id === id);
    if (!e) return { error: "An expense on this invoice no longer exists — remove that line." };
    if (!e.is_billable || e.customer_id !== customerId) return { error: `“${e.name}” isn't a billable expense for this customer.` };
    if (e.invoice_id && e.invoice_id !== docId) return { error: `“${e.name}” is already billed on another invoice.` };
  }
  return { ok: ids };
}

/** Make expenses.invoice_id match the invoice's lines: linked lines → billed, removed lines → pending again. */
export async function syncBilledExpenses(docId: number) {
  const { supabase } = await requireStaff();
  const [{ data: items }, { data: doc }] = await Promise.all([
    supabase.from("sales_doc_items").select("expense_id").eq("doc_id", docId).not("expense_id", "is", null),
    supabase.from("sales_docs").select("status").eq("id", docId).single(),
  ]);
  const ids = doc?.status === "cancelled" ? [] : (items ?? []).map((i) => i.expense_id!);
  let release = supabase.from("expenses").update({ invoice_id: null }).eq("invoice_id", docId);
  if (ids.length) release = release.not("id", "in", `(${ids.join(",")})`);
  await release;
  if (ids.length) await supabase.from("expenses").update({ invoice_id: docId }).in("id", ids).is("invoice_id", null);
  revalidatePath("/expenses");
}

function parseLines(raw: string | null): Line[] | string {
  let data: unknown;
  try {
    data = JSON.parse(raw ?? "[]");
  } catch {
    return "Line items could not be read.";
  }
  if (!Array.isArray(data)) return "Line items could not be read.";
  const lines: Line[] = [];
  for (const r of data as Record<string, unknown>[]) {
    const description = String(r.description ?? "").trim();
    if (!description) continue;
    const qty = Number(r.qty);
    const rate = Number(r.rate);
    const tax = Number(r.tax_rate);
    if (!(qty > 0)) return `Quantity for “${description}” must be more than zero.`;
    if (!Number.isFinite(rate) || rate < 0) return `Rate for “${description}” must be zero or more.`;
    lines.push({
      item_id: r.item_id ? Number(r.item_id) : null,
      description,
      long_description: String(r.long_description ?? "").trim() || null,
      qty,
      unit: String(r.unit ?? "").trim() || null,
      rate,
      tax_rate: Number.isFinite(tax) && tax >= 0 && tax <= 100 ? tax : 0,
      expense_id: r.expense_id ? Number(r.expense_id) : null,
    });
  }
  return lines;
}

/** Create or update any sales document. */
export async function saveDoc(kind: DocKind, id: number | null, _: FormState, form: FormData): Promise<FormState> {
  const { supabase, can, roleName } = await requireStaff();
  if (!can("sales", "edit")) return denied(roleName, "sales", "edit");

  const lines = parseLines(str(form, "items"));
  if (typeof lines === "string") return { error: lines };
  if (!lines.length) return { error: "Add at least one line item." };

  const party = str(form, "party"); // "customer:12" | "lead:4"
  const [ptype, pid] = party ? party.split(":") : [null, null];
  const customer_id = ptype === "customer" ? Number(pid) : null;
  const lead_id = ptype === "lead" && kind === "proposal" ? Number(pid) : null;
  if (!customer_id && !lead_id) return { error: kind === "proposal" ? "Choose a customer or lead." : "Choose a customer." };

  const date = str(form, "date") ?? new Date().toISOString().slice(0, 10);
  const due_date = KINDS[kind].dueLabel ? str(form, "due_date") : null;
  if (due_date && due_date < date) return { error: `${KINDS[kind].dueLabel} can't be before the date.` };

  const discount_percent = Math.min(100, Math.max(0, num(form, "discount_percent") ?? 0));
  const adjustment = num(form, "adjustment") ?? 0;
  const totals = computeTotals(lines, discount_percent, adjustment);
  if (totals.total < 0) return { error: "Total can't be negative." };

  const fields = {
    customer_id,
    lead_id,
    subject: str(form, "subject"),
    content: kind === "proposal" ? str(form, "content") : null,
    date,
    due_date,
    currency: (str(form, "currency") ?? "INR").toUpperCase(),
    discount_percent,
    adjustment,
    subtotal: totals.subtotal,
    discount_total: totals.discount_total,
    tax_total: totals.tax_total,
    total: totals.total,
    notes: str(form, "notes"),
    terms: str(form, "terms"),
  };

  // Recurring invoices: next copy = date + (copies made + 1) intervals
  const every = kind === "invoice" ? Math.round(num(form, "recurring_every") ?? 0) : 0;
  const unit = ["week", "month", "year"].includes(str(form, "recurring_unit") ?? "") ? str(form, "recurring_unit")! : "month";
  const cycles = Math.round(num(form, "recurring_cycles") ?? 0) || null;
  let done = 0;
  if (id && every) done = (await supabase.from("sales_docs").select("recurring_done").eq("id", id).single()).data?.recurring_done ?? 0;
  if (cycles != null && every && cycles < done) return { error: `${done} copies already exist — “stop after” can't be lower than that.` };
  const recurring =
    kind !== "invoice"
      ? {}
      : every > 0 && every <= 36
        ? { recurring_every: every, recurring_unit: unit, recurring_cycles: cycles, next_recurring_date: cycles != null && done >= cycles ? null : addInterval(date, every * (done + 1), unit) }
        : { recurring_every: null, recurring_cycles: null, next_recurring_date: null };

  let docId = id;
  if (id) {
    // Never let an edit drop an invoice below what's already been paid or credited
    if (kind === "invoice" || kind === "credit_note") {
      const bal = (await balancesFor(supabase, [id])).get(id);
      const settled = kind === "invoice" ? (bal?.paid ?? 0) + (bal?.credited ?? 0) : (bal?.credit_used ?? 0);
      if (totals.total + 0.005 < settled)
        return { error: `Total can't be less than the ${kind === "invoice" ? "amount already received" : "credit already applied"}.` };
    }
    const { error } = await supabase.from("sales_docs").update({ ...fields, ...recurring }).eq("id", id).eq("kind", kind);
    if (error) return { error: error.message };
    await supabase.from("sales_doc_items").delete().eq("doc_id", id);
  } else {
    const status = form.get("save_as") === "sent" ? "sent" : "draft";
    const { data, error } = await supabase
      .from("sales_docs")
      .insert({ ...fields, ...recurring, kind, status, sent_at: status === "sent" ? new Date().toISOString() : null })
      .select("id, number")
      .single();
    if (error) return { error: error.message };
    docId = data.id;
    const rel = customer_id ? ({ type: "customer", id: customer_id } as const) : ({ type: "lead", id: lead_id! } as const);
    await logActivity(supabase, `created ${KINDS[kind].label.toLowerCase()} ${docNumber(kind, data.number)}`, rel);
  }

  // Only invoices bill expenses; any other document drops the link
  const billed = kind === "invoice" ? await checkExpenses(lines, customer_id, docId!) : { ok: [] as number[] };
  if ("error" in billed) return { error: billed.error };
  const { error: itemsError } = await supabase
    .from("sales_doc_items")
    .insert(lines.map((l, i) => ({ ...l, expense_id: l.expense_id && billed.ok.includes(l.expense_id) ? l.expense_id : null, doc_id: docId!, position: i })));
  if (itemsError) return { error: itemsError.message };
  if (kind === "invoice") await syncBilledExpenses(docId!);

  if (kind === "invoice" && every) await supabase.rpc("run_recurring");
  revalidatePath(`/sales/${KINDS[kind].slug}`);
  redirect(docHref(kind, docId!));
}

const STATUS_VERB: Record<string, string> = { sent: "marked as sent", accepted: "marked as accepted", declined: "marked as declined", cancelled: "cancelled", draft: "reopened as draft" };

export async function setDocStatus(form: FormData) {
  const { supabase } = await assertAccess("sales", "edit");
  const id = Number(str(form, "id"));
  const status = str(form, "status")!;
  if (!(status in STATUS_VERB)) return;
  const { data: doc } = await supabase
    .from("sales_docs")
    .update({ status, ...(status === "sent" ? { sent_at: new Date().toISOString() } : {}) })
    .eq("id", id)
    .select("kind, number, customer_id, lead_id")
    .single();
  // Cancelling an invoice frees its expenses for billing again; reopening re-claims any still free
  if (doc?.kind === "invoice" && (status === "cancelled" || status === "draft")) await syncBilledExpenses(id);
  if (doc) {
    const rel = doc.customer_id ? ({ type: "customer", id: doc.customer_id } as const) : ({ type: "lead", id: doc.lead_id! } as const);
    await logActivity(supabase, `${STATUS_VERB[status]} ${docNumber(doc.kind, doc.number)}`, rel);
    revalidatePath(docHref(doc.kind, id));
    revalidatePath(`/sales/${KINDS[doc.kind].slug}`);
  }
}

/** Proposal → estimate/invoice, estimate → invoice. Copies lines; marks the source accepted. */
export async function convertDoc(form: FormData) {
  const { supabase } = await assertAccess("sales", "edit");
  const id = Number(str(form, "id"));
  const to = str(form, "to") as DocKind;
  if (to !== "estimate" && to !== "invoice") return;

  const { data: src } = await supabase.from("sales_docs").select("*").eq("id", id).single();
  if (!src) throw new Error("Document not found.");
  if (!src.customer_id) throw new Error("Convert the lead to a customer first, then link this proposal to that customer.");
  const { data: lines } = await supabase.from("sales_doc_items").select("*").eq("doc_id", id).order("position");
  const { data: settings } = await supabase.from("company_settings").select("default_terms").maybeSingle();

  const today = new Date().toISOString().slice(0, 10);
  const due = new Date(Date.now() + (to === "invoice" ? 15 : 30) * 86400_000).toISOString().slice(0, 10);
  const { data: created, error } = await supabase
    .from("sales_docs")
    .insert({
      kind: to,
      customer_id: src.customer_id,
      subject: src.subject,
      date: today,
      due_date: due,
      currency: src.currency,
      discount_percent: src.discount_percent,
      adjustment: src.adjustment,
      subtotal: src.subtotal,
      discount_total: src.discount_total,
      tax_total: src.tax_total,
      total: src.total,
      notes: src.notes,
      terms: to === "invoice" ? (settings?.default_terms ?? src.terms) : src.terms,
      source_id: src.id,
    })
    .select("id, number")
    .single();
  if (error) throw new Error(error.message);
  if (lines?.length) {
    await supabase.from("sales_doc_items").insert(
      lines.map((l) => ({
        doc_id: created.id,
        position: l.position,
        item_id: l.item_id,
        description: l.description,
        long_description: l.long_description,
        qty: l.qty,
        unit: l.unit,
        rate: l.rate,
        tax_rate: l.tax_rate,
      })),
    );
  }
  await supabase.from("sales_docs").update({ status: "accepted" }).eq("id", id);
  await logActivity(supabase, `converted ${docNumber(src.kind, src.number)} to ${docNumber(to, created.number)}`, {
    type: "customer",
    id: src.customer_id,
  });
  revalidatePath(`/sales/${KINDS[src.kind].slug}`);
  revalidatePath(`/sales/${KINDS[to].slug}`);
  redirect(docHref(to, created.id));
}

export async function deleteDoc(form: FormData) {
  const { supabase } = await assertAccess("sales", "full");
  const id = Number(str(form, "id"));
  const { data: doc } = await supabase.from("sales_docs").select("kind").eq("id", id).single();
  await supabase.from("expenses").update({ invoice_id: null }).eq("invoice_id", id);
  const { error } = await supabase.from("sales_docs").delete().eq("id", id);
  if (error) throw new Error(error.message);
  const slug = KINDS[(doc?.kind ?? "invoice") as DocKind].slug;
  revalidatePath(`/sales/${slug}`);
  redirect(`/sales/${slug}`);
}

export async function recordPayment(_: FormState, form: FormData): Promise<FormState> {
  const { supabase, can, roleName } = await requireStaff();
  if (!can("sales", "edit")) return denied(roleName, "sales", "edit");
  const invoiceId = Number(str(form, "invoice_id"));
  const amount = num(form, "amount");
  if (!amount || amount <= 0) return { error: "Enter an amount greater than zero." };
  const { data: inv } = await supabase.from("sales_docs").select("number, status, customer_id").eq("id", invoiceId).eq("kind", "invoice").single();
  if (!inv) return { error: "Invoice not found." };
  if (inv.status === "cancelled") return { error: "This invoice is cancelled." };
  const balance = (await balancesFor(supabase, [invoiceId])).get(invoiceId)?.balance ?? 0;
  if (amount > balance + 0.005) return { error: `Amount is more than the balance due (${balance.toFixed(2)}).` };

  const { error } = await supabase.from("payments").insert({
    invoice_id: invoiceId,
    amount,
    date: str(form, "date") ?? new Date().toISOString().slice(0, 10),
    mode_id: num(form, "mode_id"),
    transaction_id: str(form, "transaction_id"),
    note: str(form, "note"),
  });
  if (error) return { error: error.message };
  // Recording money against a draft means it has gone out
  if (inv.status === "draft") await supabase.from("sales_docs").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", invoiceId);
  await logActivity(supabase, `recorded a payment of ₹${amount.toLocaleString("en-IN")} on ${docNumber("invoice", inv.number)}`, {
    type: "customer",
    id: inv.customer_id!,
  });
  revalidatePath(docHref("invoice", invoiceId));
  revalidatePath("/sales/payments");
  return { ok: "Payment recorded." };
}

export async function deletePayment(form: FormData) {
  const { supabase } = await assertAccess("sales", "full");
  const id = Number(str(form, "id"));
  const invoiceId = Number(str(form, "invoice_id"));
  await supabase.from("payments").delete().eq("id", id);
  revalidatePath(docHref("invoice", invoiceId));
  revalidatePath("/sales/payments");
}

/** Apply part of a credit note to one of the same customer's invoices. */
export async function applyCredit(_: FormState, form: FormData): Promise<FormState> {
  const { supabase, can, roleName } = await requireStaff();
  if (!can("sales", "edit")) return denied(roleName, "sales", "edit");
  const creditId = Number(str(form, "credit_note_id"));
  const invoiceId = Number(str(form, "invoice_id"));
  const amount = num(form, "amount");
  if (!invoiceId) return { error: "Choose an invoice." };
  if (!amount || amount <= 0) return { error: "Enter an amount greater than zero." };

  const { data: docs } = await supabase.from("sales_docs").select("id, kind, number, customer_id, status").in("id", [creditId, invoiceId]);
  const cn = docs?.find((d) => d.id === creditId && d.kind === "credit_note");
  const inv = docs?.find((d) => d.id === invoiceId && d.kind === "invoice");
  if (!cn || !inv) return { error: "Credit note or invoice not found." };
  if (cn.customer_id !== inv.customer_id) return { error: "The invoice belongs to a different customer." };
  if (cn.status === "draft" || cn.status === "cancelled") return { error: "Issue the credit note (mark it as sent) before applying it." };

  const bals = await balancesFor(supabase, [creditId, invoiceId]);
  const available = bals.get(creditId)?.balance ?? 0;
  const due = bals.get(invoiceId)?.balance ?? 0;
  if (amount > available + 0.005) return { error: `Only ${available.toFixed(2)} credit is left on this note.` };
  if (amount > due + 0.005) return { error: `The invoice only has ${due.toFixed(2)} outstanding.` };

  const { error } = await supabase.from("credit_applications").insert({ credit_note_id: creditId, invoice_id: invoiceId, amount });
  if (error) return { error: error.message };
  await logActivity(supabase, `applied ₹${amount.toLocaleString("en-IN")} from ${docNumber("credit_note", cn.number)} to ${docNumber("invoice", inv.number)}`, {
    type: "customer",
    id: cn.customer_id!,
  });
  revalidatePath(docHref("credit_note", creditId));
  revalidatePath(docHref("invoice", invoiceId));
  return { ok: "Credit applied." };
}

export async function removeCredit(form: FormData) {
  const { supabase } = await assertAccess("sales", "full");
  const id = Number(str(form, "id"));
  const { data } = await supabase.from("credit_applications").delete().eq("id", id).select("credit_note_id, invoice_id").single();
  if (data) {
    revalidatePath(docHref("credit_note", data.credit_note_id));
    revalidatePath(docHref("invoice", data.invoice_id));
  }
}

// ───────────── Items catalogue ─────────────
export async function saveItem(_: FormState, form: FormData): Promise<FormState> {
  const { supabase, can, roleName } = await requireStaff();
  if (!can("sales", "edit")) return denied(roleName, "sales", "edit");
  const id = num(form, "id");
  const name = str(form, "name");
  const rate = num(form, "rate");
  if (!name) return { error: "Item name is required." };
  if (rate == null || rate < 0) return { error: "Rate must be zero or more." };
  const fields = { name, description: str(form, "description"), rate, unit: str(form, "unit"), tax_id: num(form, "tax_id") };
  const { error } = id ? await supabase.from("items").update(fields).eq("id", id) : await supabase.from("items").insert(fields);
  if (error) return { error: error.message };
  revalidatePath("/sales/items");
  return { ok: id ? "Item updated." : "Item added." };
}

export async function deleteItem(form: FormData) {
  const { supabase } = await assertAccess("sales", "full");
  await supabase.from("items").delete().eq("id", Number(str(form, "id")));
  revalidatePath("/sales/items");
}
