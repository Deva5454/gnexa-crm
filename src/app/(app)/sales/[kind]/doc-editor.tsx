"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { GripVertical, PackagePlus, Plus, Trash2 } from "lucide-react";
import { Button, buttonClass } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, FormError } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { computeTotals, KINDS, type DocKind, type Line } from "@/lib/sales";
import { formatMoney } from "@/lib/utils";
import type { FormState } from "../actions";

export type CatalogueItem = { id: number; name: string; description: string | null; rate: number; unit: string | null; tax_rate: number };
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

  const totals = useMemo(() => computeTotals(rows, discount, adjustment), [rows, discount, adjustment]);
  const rates = useMemo(() => [...new Set([0, ...taxRates, ...rows.map((r) => r.tax_rate)])].sort((a, b) => a - b), [taxRates, rows]);

  const update = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const remove = (key: number) => setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.key !== key) : [blank()]));
  const addFromCatalogue = (id: string) => {
    const it = catalogue.find((c) => String(c.id) === id);
    setPick("");
    if (!it) return;
    const row: Row = { key: ++seq, item_id: it.id, description: it.name, long_description: it.description ?? "", qty: 1, unit: it.unit ?? "", rate: Number(it.rate), tax_rate: Number(it.tax_rate) };
    // Replace a single untouched blank row instead of appending under it
    setRows((rs) => (rs.length === 1 && !rs[0]!.description && !rs[0]!.rate ? [row] : [...rs, row]));
  };

  const [drag, setDrag] = useState<number | null>(null);
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
                  </td>
                  <td className="space-y-1.5 px-2 py-2">
                    <input value={r.description} onChange={(e) => update(r.key, { description: e.target.value })} placeholder="Item name" className="field" aria-label="Item name" />
                    <textarea
                      value={r.long_description ?? ""}
                      onChange={(e) => update(r.key, { long_description: e.target.value })}
                      placeholder="Description (optional)"
                      rows={1}
                      className="field resize-y text-xs"
                      aria-label="Item description"
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
        </CardBody>
      </Card>

      <div className="flex flex-wrap justify-end gap-2">
        <Link href={cancelHref} className={buttonClass({ variant: "secondary" })}>Cancel</Link>
        {isNew ? (
          <>
            <SubmitButton variant="secondary" pendingText="Saving…">Save as draft</SubmitButton>
            <button type="submit" name="save_as" value="sent" className={buttonClass({ variant: "primary" })}>
              Save & mark as sent
            </button>
          </>
        ) : (
          <SubmitButton pendingText="Saving…">Save changes</SubmitButton>
        )}
      </div>
    </form>
  );
}
