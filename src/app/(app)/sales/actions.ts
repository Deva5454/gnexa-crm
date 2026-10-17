"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logActivity } from "@/lib/activity";
import { assertAccess, denied, requireStaff } from "@/lib/auth";
import { addDays, addInterval, computeTotals, docHref, docNumber, KINDS, type DocKind, type Line } from "@/lib/sales";
import { balancesFor } from "@/lib/sales-data";
import { HSN_RE } from "@/lib/gst";
import { num, str } from "@/lib/utils";
import { friendlyError, must, withFlash } from "@/lib/flash";
import { daysFromToday, todayIST } from "@/lib/dates";
import { discardUpload, fileRow } from "@/lib/uploads";

export type FormState = { error?: string; ok?: string } | undefined;

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
    const hsn = String(r.hsn_sac ?? "").replace(/\s/g, "");
    if (hsn && !HSN_RE.test(hsn)) return `HSN / SAC for “${description}” must be 4 to 8 digits.`;
    lines.push({
      item_id: r.item_id ? Number(r.item_id) : null,
      description,
      long_description: String(r.long_description ?? "").trim() || null,
      qty,
      unit: String(r.unit ?? "").trim() || null,
      rate,
      tax_rate: Number.isFinite(tax) && tax >= 0 && tax <= 100 ? tax : 0,
      expense_id: r.expense_id ? Number(r.expense_id) : null,
      hsn_sac: hsn || null,
    });
  }
  return lines;
}

/** Create or update any sales document. */
export async function saveDoc(kind: DocKind, id: number | null, _: FormState, form: FormData): Promise<FormState> {
  const { supabase, can, roleName, profile } = await requireStaff();
  if (!can("sales", "edit")) return denied(roleName, "sales", "edit");

  const lines = parseLines(str(form, "items"));
  if (typeof lines === "string") return { error: lines };
  if (!lines.length) return { error: "Add at least one line item." };

  const party = str(form, "party"); // "customer:12" | "lead:4"
  const [ptype, pid] = party ? party.split(":") : [null, null];
  const customer_id = ptype === "customer" ? Number(pid) : null;
  const lead_id = ptype === "lead" && kind === "proposal" ? Number(pid) : null;
  if (!customer_id && !lead_id) return { error: kind === "proposal" ? "Choose a customer or lead." : "Choose a customer." };

  const date = str(form, "date") ?? todayIST();
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

  // Header + lines in one transaction; the database checks expense lines, settled totals and permissions
  const status = !id && form.get("save_as") === "sent" ? "sent" : "draft";
  const { data: saved, error } = await supabase.rpc("save_sales_doc", {
    p_kind: kind,
    p_id: id,
    p_doc: { ...fields, ...recurring, ...(id ? {} : { status }) },
    p_lines: lines,
  });
  if (error) return { error: friendlyError(error.message) };
  const docId = (saved as { id: number; number: number }).id;
  // Sale agent and the private admin note sit outside the document transaction (neither affects money)
  const agent = str(form, "sale_agent");
  await supabase.from("sales_docs").update({ sale_agent: agent && /^[0-9a-f-]{36}$/i.test(agent) ? agent : null }).eq("id", docId);
  const adminNote = (str(form, "admin_note") ?? "").slice(0, 5000);
  const { data: oldNote } = id ? await supabase.from("sales_doc_notes").select("note").eq("doc_id", docId).maybeSingle() : { data: null };
  if (adminNote && adminNote !== oldNote?.note) await supabase.from("sales_doc_notes").upsert({ doc_id: docId, note: adminNote, updated_by: profile.id, updated_at: new Date().toISOString() });
  else if (!adminNote && oldNote) await supabase.from("sales_doc_notes").delete().eq("doc_id", docId);
  if (!id) {
    const rel = customer_id ? ({ type: "customer", id: customer_id } as const) : ({ type: "lead", id: lead_id! } as const);
    await logActivity(supabase, `created ${KINDS[kind].label.toLowerCase()} ${docNumber(kind, (saved as { number: number }).number)}`, rel);
  }
  if (kind === "invoice") revalidatePath("/expenses");

  if (kind === "invoice" && every) await supabase.rpc("run_recurring");
  revalidatePath(`/sales/${KINDS[kind].slug}`);
  redirect(docHref(kind, docId));
}

const STATUS_VERB: Record<string, string> = { sent: "marked as sent", accepted: "marked as accepted", declined: "marked as declined", cancelled: "cancelled", draft: "reopened as draft" };

export async function setDocStatus(form: FormData) {
  return withFlash(async () => {
    const { supabase } = await assertAccess("sales", "edit");
    const id = Number(str(form, "id"));
    const status = str(form, "status")!;
    if (!(status in STATUS_VERB)) return;
    const { data: doc, error } = await supabase
      .from("sales_docs")
      .update({ status, ...(status === "sent" ? { sent_at: new Date().toISOString() } : {}) })
      .eq("id", id)
      .select("kind, number, customer_id, lead_id")
      .single();
    // The database refuses to cancel or reopen documents with money on them, and frees billed expenses and hours on cancel
    if (error) throw new Error(error.message);
    if (doc.kind === "invoice") revalidatePath("/expenses");
    if (doc) {
      const rel = doc.customer_id ? ({ type: "customer", id: doc.customer_id } as const) : ({ type: "lead", id: doc.lead_id! } as const);
      await logActivity(supabase, `${STATUS_VERB[status]} ${docNumber(doc.kind, doc.number)}`, rel);
      revalidatePath(docHref(doc.kind, id));
      revalidatePath(`/sales/${KINDS[doc.kind].slug}`);
    }
  });
}

/** Proposal → estimate/invoice, estimate → invoice. Copies lines; marks the source accepted. */
export async function convertDoc(form: FormData) {
  return withFlash(async () => {
    const { supabase } = await assertAccess("sales", "edit");
    const id = Number(str(form, "id"));
    const to = str(form, "to") as DocKind;
    if (to !== "estimate" && to !== "invoice") return;

    const { data: src } = await supabase.from("sales_docs").select("*").eq("id", id).single();
    if (!src) throw new Error("Document not found.");
    if (src.kind !== "proposal" && src.kind !== "estimate") throw new Error("Only proposals and estimates can be converted.");
    if (src.kind === "estimate" && to === "estimate") throw new Error("This is already an estimate.");
    if (!src.customer_id) throw new Error("Convert the lead to a customer first, then link this proposal to that customer.");
    const { data: existing } = await supabase.from("sales_docs").select("id, kind").eq("source_id", id).neq("status", "cancelled").limit(1).maybeSingle();
    if (existing) redirect(docHref(existing.kind, existing.id)); // already converted (e.g. a double click)
    const { data: lines } = await supabase.from("sales_doc_items").select("*").eq("doc_id", id).order("position");
    if (!lines?.length) throw new Error("This document has no line items to convert.");
    const { data: settings } = await supabase.from("company_settings").select("default_terms").maybeSingle();

    const today = todayIST();
    const due = daysFromToday(to === "invoice" ? 15 : 30);
    const copied: Line[] = lines.map((l) => ({
      item_id: l.item_id,
      hsn_sac: l.hsn_sac,
      description: l.description,
      long_description: l.long_description,
      qty: Number(l.qty),
      unit: l.unit,
      rate: Number(l.rate),
      tax_rate: Number(l.tax_rate),
    }));
    const totals = computeTotals(copied, Number(src.discount_percent), Number(src.adjustment));
    const { data: saved, error } = await supabase.rpc("save_sales_doc", {
      p_kind: to,
      p_id: null,
      p_doc: {
        customer_id: src.customer_id,
        subject: src.subject,
        date: today,
        due_date: due,
        currency: src.currency,
        discount_percent: Number(src.discount_percent),
        adjustment: Number(src.adjustment),
        ...totals,
        notes: src.notes,
        terms: to === "invoice" ? (settings?.default_terms ?? src.terms) : src.terms,
        source_id: src.id,
      },
      p_lines: copied,
    });
    if (error) throw new Error(error.message);
    const created = saved as { id: number; number: number };
    must(await supabase.from("sales_docs").update({ status: "accepted" }).eq("id", id));
    await logActivity(supabase, `converted ${docNumber(src.kind, src.number)} to ${docNumber(to, created.number)}`, {
      type: "customer",
      id: src.customer_id,
    });
    revalidatePath(`/sales/${KINDS[src.kind].slug}`);
    revalidatePath(`/sales/${KINDS[to].slug}`);
    redirect(docHref(to, created.id));
  });
}

export async function deleteDoc(form: FormData) {
  return withFlash(async () => {
    const { supabase } = await assertAccess("sales", "full");
    const id = Number(str(form, "id"));
    const { data: doc } = await supabase.from("sales_docs").select("kind").eq("id", id).single();
    const { data: files } = await supabase.from("sales_doc_files").select("path").eq("doc_id", id);
    // Billed expenses are released by the foreign key; documents with money on them are refused by the database
    const { error } = await supabase.from("sales_docs").delete().eq("id", id);
    if (error) throw new Error(error.message);
    if (files?.length) await supabase.storage.from(SALES_BUCKET).remove(files.map((f) => f.path));
    const slug = KINDS[(doc?.kind ?? "invoice") as DocKind].slug;
    revalidatePath(`/sales/${slug}`);
    redirect(`/sales/${slug}`);
  });
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
    date: str(form, "date") ?? todayIST(),
    mode_id: num(form, "mode_id"),
    transaction_id: str(form, "transaction_id"),
    note: str(form, "note"),
  });
  if (error) return { error: friendlyError(error.message) };
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
  return withFlash(async () => {
    const { supabase } = await assertAccess("sales", "full");
    const id = Number(str(form, "id"));
    const invoiceId = Number(str(form, "invoice_id"));
    const { error } = await supabase.from("payments").delete().eq("id", id).eq("invoice_id", invoiceId);
    if (error) throw new Error(error.message);
    revalidatePath(docHref("invoice", invoiceId));
    revalidatePath("/sales/payments");
  });
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
  if (error) return { error: friendlyError(error.message) };
  await logActivity(supabase, `applied ₹${amount.toLocaleString("en-IN")} from ${docNumber("credit_note", cn.number)} to ${docNumber("invoice", inv.number)}`, {
    type: "customer",
    id: cn.customer_id!,
  });
  revalidatePath(docHref("credit_note", creditId));
  revalidatePath(docHref("invoice", invoiceId));
  return { ok: "Credit applied." };
}

export async function removeCredit(form: FormData) {
  return withFlash(async () => {
    const { supabase } = await assertAccess("sales", "full");
    const id = Number(str(form, "id"));
    const { data } = await supabase.from("credit_applications").delete().eq("id", id).select("credit_note_id, invoice_id").single();
    if (data) {
      revalidatePath(docHref("credit_note", data.credit_note_id));
      revalidatePath(docHref("invoice", data.invoice_id));
    }
  });
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
  const hsn = (str(form, "hsn_sac") ?? "").replace(/\s/g, "");
  if (hsn && !HSN_RE.test(hsn)) return { error: "HSN / SAC must be 4 to 8 digits." };
  // Fixed prices in other currencies: inputs named rate_USD, rate_EUR… (blank = convert from the base rate)
  const currency_rates: Record<string, number> = {};
  for (const [k, v] of form.entries()) {
    const code = /^rate_([A-Z]{3})$/.exec(k)?.[1];
    if (!code || typeof v !== "string" || !v.trim()) continue;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) return { error: `The ${code} price must be zero or more.` };
    currency_rates[code] = Math.round(n * 100) / 100;
  }
  const fields = { name, description: str(form, "description"), rate, unit: str(form, "unit"), tax_id: num(form, "tax_id"), hsn_sac: hsn || null, group_id: num(form, "group_id"), currency_rates };
  const { error } = id ? await supabase.from("items").update(fields).eq("id", id) : await supabase.from("items").insert(fields);
  if (error) return { error: friendlyError(error.message) };
  revalidatePath("/sales/items");
  return { ok: id ? "Item updated." : "Item added." };
}

/** Bulk actions from the item list. */
export async function bulkItems(form: FormData) {
  return withFlash(async () => {
    const op = str(form, "op") ?? "";
    const ids = [...new Set(form.getAll("ids").map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, 500);
    if (!ids.length) throw new Error("Tick at least one item first.");
    const { supabase } = await assertAccess("sales", op === "delete" ? "full" : "edit");
    const target = str(form, "target");
    switch (op) {
      case "group": must(await supabase.from("items").update({ group_id: target && target !== "none" ? Number(target) : null }).in("id", ids)); break;
      case "tax": must(await supabase.from("items").update({ tax_id: target && target !== "none" ? Number(target) : null }).in("id", ids)); break;
      case "delete": must(await supabase.from("items").delete().in("id", ids)); break;
      default: throw new Error("Pick an action.");
    }
    revalidatePath("/sales/items");
  });
}

// ───────────── Item groups ─────────────
export async function saveItemGroup(form: FormData) {
  return withFlash(async () => {
    const { supabase } = await assertAccess("sales", "edit");
    const name = (str(form, "name") ?? "").slice(0, 80);
    if (!name) throw new Error("Give the group a name.");
    const id = num(form, "id");
    must(id ? await supabase.from("item_groups").update({ name }).eq("id", id) : await supabase.from("item_groups").insert({ name }));
    revalidatePath("/sales/items");
  });
}

export async function deleteItemGroup(form: FormData) {
  return withFlash(async () => {
    const { supabase } = await assertAccess("sales", "edit");
    must(await supabase.from("item_groups").delete().eq("id", num(form, "id") ?? 0));
    revalidatePath("/sales/items");
  });
}

export async function deleteItem(form: FormData) {
  return withFlash(async () => {
    const { supabase } = await assertAccess("sales", "full");
    must(await supabase.from("items").delete().eq("id", Number(str(form, "id"))));
    revalidatePath("/sales/items");
  });
}

// ───────────── Copy (Perfex "Copy invoice") ─────────────
/** A new draft with the same customer, lines and terms, dated today (due date keeps the same gap). */
export async function copyDoc(form: FormData) {
  return withFlash(async () => {
    const { supabase, profile } = await assertAccess("sales", "edit");
    const id = Number(str(form, "id"));
    const [{ data: src }, { data: lines }] = await Promise.all([
      supabase.from("sales_docs").select("*").eq("id", id).single(),
      supabase.from("sales_doc_items").select("*").eq("doc_id", id).order("position"),
    ]);
    if (!src) throw new Error("Document not found.");
    if (!lines?.length) throw new Error("This document has no line items to copy.");
    const kind = src.kind as DocKind;
    const today = todayIST();
    const gap = src.due_date ? Math.round((Date.parse(src.due_date) - Date.parse(src.date)) / 86400_000) : null;
    // Billed expenses and project hours belong to the original — the copy gets plain lines
    const copied: Line[] = lines.map((l) => ({
      item_id: l.item_id, hsn_sac: l.hsn_sac, description: l.description, long_description: l.long_description,
      qty: Number(l.qty), unit: l.unit, rate: Number(l.rate), tax_rate: Number(l.tax_rate),
    }));
    const totals = computeTotals(copied, Number(src.discount_percent), Number(src.adjustment));
    const { data: saved, error } = await supabase.rpc("save_sales_doc", {
      p_kind: kind,
      p_id: null,
      p_doc: {
        customer_id: src.customer_id, lead_id: src.lead_id, subject: src.subject, content: src.content,
        date: today, due_date: gap != null ? addDays(today, gap) : null, currency: src.currency,
        discount_percent: Number(src.discount_percent), adjustment: Number(src.adjustment), ...totals,
        notes: src.notes, terms: src.terms, status: "draft",
      },
      p_lines: copied,
    });
    if (error) throw new Error(error.message);
    const created = saved as { id: number; number: number };
    await supabase.from("sales_docs").update({ sale_agent: src.sale_agent ?? profile.id }).eq("id", created.id);
    const rel = src.customer_id ? ({ type: "customer", id: src.customer_id } as const) : ({ type: "lead", id: src.lead_id! } as const);
    await logActivity(supabase, `copied ${docNumber(kind, src.number)} to ${docNumber(kind, created.number)}`, rel);
    revalidatePath(`/sales/${KINDS[kind].slug}`);
    redirect(docHref(kind, created.id));
  });
}

// ───────────── Bulk actions (list) ─────────────
export async function bulkDocs(form: FormData) {
  return withFlash(async () => {
    const op = str(form, "op") ?? "";
    const kind = str(form, "kind") as DocKind;
    if (!(kind in KINDS)) throw new Error("Unknown document type.");
    const ids = [...new Set(form.getAll("ids").map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, 200);
    if (!ids.length) throw new Error("Tick at least one document first.");
    if (op === "pdf") {
      await assertAccess("sales", "view");
      redirect(`/print/bulk?kind=${kind}&ids=${ids.join(",")}`);
    }
    const { supabase } = await assertAccess("sales", op === "delete" ? "full" : "edit");
    const target = str(form, "target");
    const label = KINDS[kind].label.toLowerCase();
    const n = `${ids.length} ${label}${ids.length === 1 ? "" : "s"}`;
    // Status changes go one by one: the database refuses some (money on them, project invoices…) and we report those
    const setStatus = async (status: string, from: string[]) => {
      const { data } = await supabase.from("sales_docs").select("id, status").in("id", ids).eq("kind", kind);
      let done = 0;
      const failed: string[] = [];
      for (const d of data ?? []) {
        if (!from.includes(d.status)) continue;
        const { error } = await supabase.from("sales_docs").update({ status, ...(status === "sent" ? { sent_at: new Date().toISOString() } : {}) }).eq("id", d.id);
        if (error) failed.push(error.message);
        else done++;
      }
      return { done, failed };
    };
    let summary: { done: number; failed: string[] } | null = null;
    switch (op) {
      case "sent":
        summary = await setStatus("sent", ["draft"]);
        break;
      case "cancelled":
        summary = await setStatus("cancelled", ["draft", "sent"]);
        break;
      case "accepted":
      case "declined":
        summary = await setStatus(op, ["sent"]);
        break;
      case "agent":
        must(await supabase.from("sales_docs").update({ sale_agent: target && target !== "none" ? target : null }).in("id", ids).eq("kind", kind));
        break;
      case "delete": {
        const { data: files } = await supabase.from("sales_doc_files").select("path").in("doc_id", ids);
        let done = 0;
        const failed: string[] = [];
        for (const id of ids) {
          const { error } = await supabase.from("sales_docs").delete().eq("id", id).eq("kind", kind);
          if (error) failed.push(error.message);
          else done++;
        }
        if (files?.length) {
          const { data: left } = await supabase.from("sales_doc_files").select("path").in("doc_id", ids);
          const keep = new Set((left ?? []).map((f) => f.path));
          const gone = files.map((f) => f.path).filter((p) => !keep.has(p));
          if (gone.length) await supabase.storage.from(SALES_BUCKET).remove(gone);
        }
        summary = { done, failed };
        break;
      }
      default:
        throw new Error("Pick an action.");
    }
    await logActivity(supabase, `bulk ${op} on ${n}`);
    if (kind === "invoice") revalidatePath("/expenses");
    revalidatePath(`/sales/${KINDS[kind].slug}`);
    if (summary && summary.failed.length) {
      throw new Error(`${summary.done} done. ${summary.failed.length} skipped: ${[...new Set(summary.failed)].slice(0, 2).join(" ")}`);
    }
  });
}

// ───────────── Batch payments (Perfex 3) ─────────────
/** Record payments on several invoices at once: amount_<invoiceId> fields, one shared date and mode. */
export async function recordBatchPayments(_: FormState, form: FormData): Promise<FormState> {
  const { supabase, can, roleName } = await requireStaff();
  if (!can("sales", "edit")) return denied(roleName, "sales", "edit");
  const date = str(form, "date") ?? todayIST();
  const mode = num(form, "mode_id");
  const entries: { id: number; amount: number; ref: string | null }[] = [];
  for (const [k, v] of form.entries()) {
    const m = k.match(/^amount_(\d+)$/);
    const amount = Number(String(v).replace(/,/g, ""));
    if (m && amount > 0) entries.push({ id: Number(m[1]), amount: Math.round(amount * 100) / 100, ref: str(form, `ref_${m[1]}`) });
  }
  if (!entries.length) return { error: "Enter an amount for at least one invoice." };
  if (entries.length > 100) return { error: "Record at most 100 payments at a time." };
  const ids = entries.map((e) => e.id);
  const [{ data: invs }, bals] = await Promise.all([
    supabase.from("sales_docs").select("id, number, status, customer_id").in("id", ids).eq("kind", "invoice"),
    balancesFor(supabase, ids),
  ]);
  for (const e of entries) {
    const inv = invs?.find((i) => i.id === e.id);
    if (!inv || inv.status === "cancelled") return { error: `Invoice #${e.id} can't take payments.` };
    const balance = bals.get(e.id)?.balance ?? 0;
    if (e.amount > balance + 0.005) return { error: `${docNumber("invoice", inv.number)}: amount is more than the balance due (${balance.toFixed(2)}).` };
  }
  const { error } = await supabase.from("payments").insert(entries.map((e) => ({ invoice_id: e.id, amount: e.amount, date, mode_id: mode, transaction_id: e.ref })));
  if (error) return { error: friendlyError(error.message) };
  const drafts = (invs ?? []).filter((i) => i.status === "draft").map((i) => i.id);
  if (drafts.length) await supabase.from("sales_docs").update({ status: "sent", sent_at: new Date().toISOString() }).in("id", drafts);
  const total = entries.reduce((s, e) => s + e.amount, 0);
  await logActivity(supabase, `recorded ${entries.length} payments totalling ₹${total.toLocaleString("en-IN")} (batch)`);
  revalidatePath("/sales/invoices");
  revalidatePath("/sales/payments");
  revalidatePath("/dashboard");
  return { ok: `${entries.length} payment${entries.length === 1 ? "" : "s"} recorded.` };
}

// ───────────── Attachments (uploaded from the browser straight to storage) ─────────────
const SALES_BUCKET = "sales-files";

export async function recordDocFile(input: { rel_id: number; name: string; path: string; size: number; mime: string | null }): Promise<{ error?: string }> {
  const { supabase, can, roleName } = await requireStaff();
  if (!can("sales", "edit")) return denied(roleName, "sales", "edit");
  const row = fileRow(input);
  const docId = Number(input.rel_id);
  if (!row || !row.path.startsWith(`${docId}/`)) return { error: "Invalid file." };
  const { data: doc } = await supabase.from("sales_docs").select("kind").eq("id", docId).maybeSingle();
  if (!doc) return { error: "Document not found." };
  const { error } = await supabase.from("sales_doc_files").insert({ doc_id: docId, ...row });
  if (error) {
    await discardUpload(supabase, SALES_BUCKET, "sales_doc_files", row.path);
    return { error: friendlyError(error.message) };
  }
  revalidatePath(docHref(doc.kind as DocKind, docId));
  return {};
}

export async function deleteDocFile(form: FormData) {
  return withFlash(async () => {
    const { supabase } = await assertAccess("sales", "edit");
    const { data } = await supabase.from("sales_doc_files").delete().eq("id", Number(str(form, "id"))).select("path, doc:sales_docs(id, kind)").maybeSingle();
    if (!data) throw new Error("Only the uploader, or someone with full sales access, can delete this file.");
    await supabase.storage.from(SALES_BUCKET).remove([data.path]);
    if (data.doc) revalidatePath(docHref(data.doc.kind as DocKind, data.doc.id));
  });
}

/** Pipeline drag: change an estimate's or proposal's status. */
export async function moveDocStatus(id: number, status: string): Promise<{ error?: string }> {
  const { supabase, can, roleName } = await requireStaff();
  if (!can("sales", "edit")) return denied(roleName, "sales", "edit");
  if (!["draft", "sent", "accepted", "declined"].includes(status)) return { error: "Unknown status." };
  const { data: doc, error } = await supabase
    .from("sales_docs")
    .update({ status, ...(status === "sent" ? { sent_at: new Date().toISOString() } : {}) })
    .eq("id", id)
    .in("kind", ["estimate", "proposal"])
    .select("kind, number, customer_id, lead_id")
    .maybeSingle();
  if (error) return { error: friendlyError(error.message) };
  if (!doc) return { error: "Document not found." };
  const rel = doc.customer_id ? ({ type: "customer", id: doc.customer_id } as const) : ({ type: "lead", id: doc.lead_id! } as const);
  await logActivity(supabase, `${STATUS_VERB[status]} ${docNumber(doc.kind, doc.number)}`, rel);
  revalidatePath(`/sales/${KINDS[doc.kind].slug}`);
  revalidatePath(docHref(doc.kind, id));
  return {};
}

// ───────────── Public link & discussion (Perfex proposal link / comments) ─────────────
const quoteHref = async (supabase: Awaited<ReturnType<typeof requireStaff>>["supabase"], id: number) => {
  const { data } = await supabase.from("sales_docs").select("kind").eq("id", id).maybeSingle();
  return data ? docHref(data.kind as DocKind, id) : "/sales/proposals";
};

export async function createPublicLink(form: FormData) {
  return withFlash(async () => {
    const { supabase } = await assertAccess("sales", "edit");
    const id = Number(str(form, "id"));
    must(await supabase.from("sales_docs").update({ public_token: crypto.randomUUID() }).eq("id", id).in("kind", ["proposal", "estimate"]).is("public_token", null));
    revalidatePath(await quoteHref(supabase, id));
  });
}

/** Turn the link off — anyone holding the old one sees "not found". A new link can be made later. */
export async function disablePublicLink(form: FormData) {
  return withFlash(async () => {
    const { supabase } = await assertAccess("sales", "edit");
    const id = Number(str(form, "id"));
    must(await supabase.from("sales_docs").update({ public_token: null }).eq("id", id));
    revalidatePath(await quoteHref(supabase, id));
  });
}

export async function setAllowComments(form: FormData) {
  return withFlash(async () => {
    const { supabase } = await assertAccess("sales", "edit");
    const id = Number(str(form, "id"));
    must(await supabase.from("sales_docs").update({ allow_comments: str(form, "allow") === "1" }).eq("id", id));
    revalidatePath(await quoteHref(supabase, id));
  });
}

export async function addDocComment(_: FormState, form: FormData): Promise<FormState> {
  const { supabase, can, roleName } = await requireStaff();
  if (!can("sales", "edit")) return denied(roleName, "sales", "edit");
  const id = Number(str(form, "doc_id"));
  const body = (str(form, "body") ?? "").slice(0, 2000);
  if (!body) return { error: "Write a comment first." };
  const { error } = await supabase.from("sales_doc_comments").insert({ doc_id: id, body });
  if (error) return { error: friendlyError(error.message) };
  revalidatePath(await quoteHref(supabase, id));
  return { ok: "Comment posted." };
}

export async function deleteDocComment(form: FormData) {
  return withFlash(async () => {
    const { supabase } = await assertAccess("sales", "edit");
    const { data } = await supabase.from("sales_doc_comments").delete().eq("id", Number(str(form, "id"))).select("doc_id").maybeSingle();
    if (!data) throw new Error("Only the author, or someone with full sales access, can delete this comment.");
    revalidatePath(await quoteHref(supabase, data.doc_id));
  });
}
