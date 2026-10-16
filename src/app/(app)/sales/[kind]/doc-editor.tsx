"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, GripVertical, PackagePlus, Plus, Receipt, Trash2 } from "lucide-react";
import { Button, buttonClass } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, FormError } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { computeTotals, expenseLine, KINDS, type DocKind, type Line } from "@/lib/sales";
import type { BillableExpense } from "./editor-data";
import { formatMoney } from "@/lib/utils";
import type { FormState } from "../actions";

export type CatalogueItem = { id: number; name: string; description: string | null; rate: number; unit: string | null; tax_rate: number; hsn_sac: string | null };
export type PartyOption = { value: string; label: string; currency?: string | null };
type Row = Line & { key: number };

export type DocDraft = {
  party: string;
  subject: string;
  content: string;
  date: string;
  due_date: string;
  currency: string;
  discount_percent: number;
  adjustment: number;
  notes: string;
  terms: string;
  lines: Line[];
  recurring_every?: number | null;
  recurring_unit?: string;
  recurring_cycles?: number | null;
  sale_agent?: string;
  admin_note?: string;
};

let seq = 0;
const blank = (): Row => ({ key: ++seq, description: "", long_description: "", qty: 1, unit: "", rate: 0, tax_rate: 18 });

export function DocEditor({
  kind,
  action,
  draft,
  customers,
  leads,
  catalogue,
  taxRates,
  currencies = ["INR"],
  billableExpenses = [],
  staff = [],
  isNew,
  cancelHref,
}: {
  kind: DocKind;
  action: (s: FormState, f: FormData) => Promise<FormState>;
  draft: DocDraft;
  customers: PartyOption[];
  leads: PartyOption[];
  catalogue: CatalogueItem[];
  taxRates: number[];
  currencies?: string[];
  billableExpenses?: BillableExpense[];
  staff?: { value: string; label: string }[];
  isNew: boolean;
  cancelHref: string;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const [rows, setRows] = useState<Row[]>(() => (draft.lines.length ? draft.lines.map((l) => ({ ...l, key: ++seq })) : [blank()]));
  const [discount, setDiscount] = useState(draft.discount_percent);
  const [adjustment, setAdjustment] = useState(draft.adjustment);
  const [pick, setPick] = useState("");
  const k = KINDS[kind];
  const [cur, setCur] = useState(draft.currency || "INR");
  const [party, setParty] = useState(draft.party);

  // Billable expenses for the chosen customer that aren't on another invoice yet
  const customerId = party.startsWith("customer:") ? Number(party.split(":")[1]) : null;
  const pendingExpenses = kind === "invoice" && customerId ? billableExpenses.filter((e) => e.customer_id === customerId) : [];
  const onInvoice = new Set(rows.map((r) => r.expense_id).filter(Boolean));
  const toggleExpense = (e: BillableExpense) =>
    setRows((rs) => {
      if (rs.some((r) => r.expense_id === e.id)) {
        const left = rs.filter((r) => r.expense_id !== e.id);
        return left.length ? left : [blank()];
      }
      const row: Row = { ...expenseLine(e), key: ++seq };
      return rs.length === 1 && !rs[0]!.description && !rs[0]!.rate ? [row] : [...rs, row];
    });

  const totals = useMemo(() => computeTotals(rows, discount, adjustment), [rows, discount, adjustment]);
  const rates = useMemo(() => [...new Set([0, ...taxRates, ...rows.map((r) => r.tax_rate)])].sort((a, b) => a - b), [taxRates, rows]);

  const update = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const remove = (key: number) => setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.key !== key) : [blank()]));
  const addFromCatalogue = (id: string) => {
    const it = catalogue.find((c) => String(c.id) === id);
    setPick("");
    if (!it) return;
    const row: Row = { key: ++seq, item_id: it.id, description: it.name, long_description: it.description ?? "", qty: 1, unit: it.unit ?? "", rate: Number(it.rate), tax_rate: Number(it.tax_rate), hsn_sac: it.hsn_sac ?? "" };
    // Replace a single untouched blank row instead of appending under it
    setRows((rs) => (rs.length === 1 && !rs[0]!.description && !rs[0]!.rate ? [row] : [...rs, row]));
  };

  const [drag, setDrag] = useState<number | null>(null);
  // Keyboard alternative to dragging: move a line one place up or down
  const shift = (key: number, by: -1 | 1) =>
    setRows((rs) => {
      const i = rs.findIndex((r) => r.key === key);
      const j = i + by;
      if (i < 0 || j < 0 || j >= rs.length) return rs;
      const next = [...rs];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });

  const moveTo = (target: number) => {
    if (drag == null || drag === target) return;
    setRows((rs) => {
      const from = rs.findIndex((r) => r.key === drag);
      const to = rs.findIndex((r) => r.key === target);
      const next = [...rs];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved!);
      return next;
    });
  };

  return (
    <form action={formAction} className="space-y-6">
      <FormError message={state?.error} />
      <input type="hidden" name="items" value={JSON.stringify(rows, (k, v) => (k === "key" ? undefined : v))} />
      <input type="hidden" name="currency" value={cur} />

      <Card>
        <CardHeader title={`${k.label} details`} />
        <CardBody className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label={kind === "proposal" ? "Customer or lead *" : "Customer *"} htmlFor="party" className="sm:col-span-2">
            <select
              id="party"
              name="party"
              required
              defaultValue={draft.party}
              onChange={(e) => {
                const c = customers.find((x) => x.value === e.target.value);
                if (isNew && c?.currency) setCur(c.currency);
                setParty(e.target.value);
                // Expense lines belong to one customer — drop them when the customer changes
                setRows((rs) => {
                  const left = rs.filter((r) => !r.expense_id);
                  return left.length ? left : [blank()];
                });
              }}
              className="field"
            >
              <option value="">— Select —</option>
              <optgroup label="Customers">
                {customers.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </optgroup>
              {kind === "proposal" && leads.length > 0 && (
                <optgroup label="Leads">
                  {leads.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                </optgroup>
              )}
            </select>
          </Field>
          <Field label="Currency" htmlFor="currency_pick">
            <select id="currency_pick" value={cur} onChange={(e) => setCur(e.target.value)} className="field">
              {[...new Set([cur, ...currencies])].map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Date" htmlFor="date">
            <input id="date" name="date" type="date" required defaultValue={draft.date} className="field" />
          </Field>
          {k.dueLabel ? (
            <Field label={k.dueLabel} htmlFor="due_date">
              <input id="due_date" name="due_date" type="date" defaultValue={draft.due_date} className="field" />
            </Field>
          ) : (
            <div />
          )}
          <Field label={kind === "proposal" ? "Subject *" : "Reference / subject"} htmlFor="subject" className="sm:col-span-2 lg:col-span-4">
            <input id="subject" name="subject" required={kind === "proposal"} defaultValue={draft.subject} placeholder={kind === "invoice" ? "e.g. Annual maintenance — Q4" : ""} className="field" />
          </Field>
          {kind === "proposal" && (
            <Field label="Proposal content" htmlFor="content" className="sm:col-span-2 lg:col-span-4" hint="The pitch: problem, approach, timeline. Shown above the pricing table.">
              <textarea id="content" name="content" rows={6} defaultValue={draft.content} className="field" />
            </Field>
          )}
        </CardBody>
      </Card>

      {pendingExpenses.length > 0 && (
        <Card className="border-amber-200">
          <CardHeader
            title={<span className="flex items-center gap-2"><Receipt className="h-4 w-4 text-amber-500" /> Billable expenses for this customer</span>}
            description={`${pendingExpenses.filter((e) => !onInvoice.has(e.id)).length} pending billing — tick to add them as lines. They're marked billed when you save.`}
            action={
              pendingExpenses.some((e) => !onInvoice.has(e.id)) && (
                <button type="button" onClick={() => pendingExpenses.filter((e) => !onInvoice.has(e.id)).forEach(toggleExpense)} className="text-xs font-semibold text-brand-600 hover:text-brand-800">
                  Add all
                </button>
              )
            }
          />
          <ul className="divide-y divide-slate-100">
            {pendingExpenses.map((e) => (
              <li key={e.id}>
                <label className="flex cursor-pointer items-center gap-3 px-5 py-2.5 text-sm hover:bg-slate-50">
                  <input type="checkbox" checked={onInvoice.has(e.id)} onChange={() => toggleExpense(e)} className="h-4 w-4 rounded border-slate-300 text-brand-600" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-slate-800">{e.name}</span>
                    <span className="block text-xs text-slate-500">
                      {[e.category, new Date(`${e.date}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="block font-semibold text-slate-800">{formatMoney(e.amount * (1 + e.tax_rate / 100), cur)}</span>
                    {e.tax_rate > 0 && <span className="block text-[11px] text-slate-400">incl. GST {e.tax_rate}%</span>}
                  </span>
                  {onInvoice.has(e.id) ? (
                    <span className="w-20 text-right text-[11px] font-semibold text-emerald-600">{e.invoice_id ? "Billed here" : "On invoice"}</span>
                  ) : (
                    <span className="w-20 text-right text-[11px] font-semibold text-amber-600">Pending</span>
                  )}
                </label>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <CardHeader
          title="Line items"
          description="Drag the handle to reorder"
          action={
            catalogue.length > 0 && (
              <label className="flex items-center gap-2 text-sm">
                <PackagePlus className="h-4 w-4 text-brand-500" />
                <select value={pick} onChange={(e) => addFromCatalogue(e.target.value)} className="field h-9 w-56 py-1" aria-label="Add item from catalogue">
                  <option value="">Add from catalogue…</option>
                  {catalogue.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} — {formatMoney(Number(c.rate), cur)}</option>
                  ))}
                </select>
              </label>
            )
          }
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="w-8" />
                <th className="px-2 py-2.5">Item</th>
                <th className="w-24 px-2 py-2.5 text-right">Qty</th>
                <th className="w-20 px-2 py-2.5">Unit</th>
                <th className="w-32 px-2 py-2.5 text-right">Rate</th>
                <th className="w-36 px-2 py-2.5">Tax</th>
                <th className="w-32 px-2 py-2.5 text-right">Amount</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.key}
                  onDragOver={(e) => {
                    e.preventDefault();
                    moveTo(r.key);
                  }}
                  className="border-b border-slate-100 align-top"
                >
                  <td className="pl-2 pt-3">
                    <span
                      draggable
                      onDragStart={() => setDrag(r.key)}
                      onDragEnd={() => setDrag(null)}
                      className="cursor-grab text-slate-300 hover:text-slate-500 active:cursor-grabbing"
                      aria-label="Drag to reorder"
                    >
                      <GripVertical className="h-4 w-4" />
                    </span>
                    <span className="mt-1 flex flex-col">
                      <button type="button" onClick={() => shift(r.key, -1)} className="rounded text-slate-300 hover:text-slate-600 focus:text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-200" aria-label="Move line up">
                        <ChevronUp className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => shift(r.key, 1)} className="rounded text-slate-300 hover:text-slate-600 focus:text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-200" aria-label="Move line down">
                        <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  </td>
                  <td className="space-y-1.5 px-2 py-2">
                    {r.expense_id && <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-700"><Receipt className="h-3 w-3" /> Expense</span>}
                    <input value={r.description} onChange={(e) => update(r.key, { description: e.target.value })} placeholder="Item name" className="field" aria-label="Item name" />
                    <textarea
                      value={r.long_description ?? ""}
                      onChange={(e) => update(r.key, { long_description: e.target.value })}
                      placeholder="Description (optional)"
                      rows={1}
                      className="field resize-y text-xs"
                      aria-label="Item description"
                    />
                    <input
                      value={r.hsn_sac ?? ""}
                      onChange={(e) => update(r.key, { hsn_sac: e.target.value.replace(/\D/g, "").slice(0, 8) })}
                      inputMode="numeric"
                      placeholder="HSN / SAC"
                      className="field w-32 text-xs"
                      aria-label="HSN or SAC code"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input type="number" min="0.01" step="0.01" value={r.qty} onChange={(e) => update(r.key, { qty: Number(e.target.value) })} className="field text-right" aria-label="Quantity" />
                  </td>
                  <td className="px-2 py-2">
                    <input value={r.unit ?? ""} onChange={(e) => update(r.key, { unit: e.target.value })} placeholder="nos" className="field" aria-label="Unit" />
                  </td>
                  <td className="px-2 py-2">
                    <input type="number" min="0" step="0.01" value={r.rate} onChange={(e) => update(r.key, { rate: Number(e.target.value) })} className="field text-right" aria-label="Rate" />
                  </td>
                  <td className="px-2 py-2">
                    <select value={r.tax_rate} onChange={(e) => update(r.key, { tax_rate: Number(e.target.value) })} className="field" aria-label="Tax">
                      {rates.map((t) => <option key={t} value={t}>{t ? `GST ${t}%` : "No tax"}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-2 pt-4 text-right font-medium text-slate-800">{formatMoney((r.qty || 0) * (r.rate || 0), cur)}</td>
                  <td className="pr-2 pt-3">
                    <button type="button" onClick={() => remove(r.key)} className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label="Remove line">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-6 p-5 lg:flex-row lg:items-start lg:justify-between">
          <Button type="button" variant="secondary" size="sm" onClick={() => setRows((rs) => [...rs, blank()])}>
            <Plus className="h-4 w-4" /> Add line
          </Button>
          <dl className="w-full max-w-sm space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-slate-500">Sub total</dt><dd className="font-medium">{formatMoney(totals.subtotal, cur)}</dd></div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-500">Discount %</dt>
              <dd className="flex items-center gap-2">
                <input name="discount_percent" type="number" min="0" max="100" step="0.01" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} className="field h-8 w-20 py-1 text-right" aria-label="Discount percent" />
                <span className="w-28 text-right font-medium">− {formatMoney(totals.discount_total, cur)}</span>
              </dd>
            </div>
            {totals.taxes.map((t) => (
              <div key={t.rate} className="flex justify-between"><dt className="text-slate-500">GST {t.rate}%</dt><dd className="font-medium">{formatMoney(t.amount, cur)}</dd></div>
            ))}
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-500">Adjustment</dt>
              <dd>
                <input name="adjustment" type="number" step="0.01" value={adjustment} onChange={(e) => setAdjustment(Number(e.target.value))} className="field h-8 w-36 py-1 text-right" aria-label="Adjustment" />
              </dd>
            </div>
            <div className="flex justify-between border-t-2 border-slate-900 pt-2 text-base font-bold text-slate-900"><dt>Total</dt><dd>{formatMoney(totals.total, cur)}</dd></div>
          </dl>
        </div>
      </Card>

      {kind === "invoice" && (
        <Card>
          <CardHeader title="Repeat this invoice" description="A copy is raised automatically on each due date and logged as e-mailed to the customer." />
          <CardBody className="grid gap-4 sm:grid-cols-3">
            <Field label="Repeat every" htmlFor="recurring_every">
              <div className="flex gap-2">
                <select id="recurring_every" name="recurring_every" defaultValue={draft.recurring_every ?? ""} className="field">
                  <option value="">Doesn&apos;t repeat</option>
                  {[1, 2, 3, 4, 6, 12].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
                <select name="recurring_unit" defaultValue={draft.recurring_unit ?? "month"} className="field" aria-label="Repeat unit">
                  <option value="week">week(s)</option>
                  <option value="month">month(s)</option>
                  <option value="year">year(s)</option>
                </select>
              </div>
            </Field>
            <Field label="Stop after" htmlFor="recurring_cycles" hint="Leave blank to repeat until you stop it">
              <input id="recurring_cycles" name="recurring_cycles" type="number" min={1} max={120} defaultValue={draft.recurring_cycles ?? ""} placeholder="∞" className="field" />
            </Field>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Note to customer" htmlFor="notes">
            <textarea id="notes" name="notes" rows={3} defaultValue={draft.notes} className="field" />
          </Field>
          <Field label="Terms & conditions" htmlFor="terms">
            <textarea id="terms" name="terms" rows={3} defaultValue={draft.terms} className="field" />
          </Field>
          <Field label="Sale agent" htmlFor="sale_agent" hint="The staff member credited with this sale">
            <select id="sale_agent" name="sale_agent" defaultValue={draft.sale_agent ?? ""} className="field">
              <option value="">— None —</option>
              {staff.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </Field>
          <Field label="Admin note" htmlFor="admin_note" hint="Private — never printed or shown to the customer">
            <textarea id="admin_note" name="admin_note" rows={3} maxLength={5000} defaultValue={draft.admin_note ?? ""} className="field" />
          </Field>
        </CardBody>
      </Card>

      <div className="flex flex-wrap justify-end gap-2">
        <Link href={cancelHref} className={buttonClass({ variant: "secondary" })}>Cancel</Link>
        {isNew ? (
          <>
            <SubmitButton variant="secondary" pendingText="Saving…">Save as draft</SubmitButton>
            <SubmitButton name="save_as" value="sent" pendingText="Saving…">Save & mark as sent</SubmitButton>
          </>
        ) : (
          <SubmitButton pendingText="Saving…">Save changes</SubmitButton>
        )}
      </div>
    </form>
  );
}
