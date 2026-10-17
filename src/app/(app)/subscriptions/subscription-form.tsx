"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { buttonClass } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, FormError } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import type { Tables } from "@/lib/database.types";
import { formatMoney } from "@/lib/utils";
import type { FormState } from "./actions";
import { todayIST } from "@/lib/dates";

type Item = { id: number; name: string; description: string | null; rate: number; tax_rate: number };

export function SubscriptionForm({
  action,
  sub,
  customers,
  items,
  taxRates,
  projects,
  defaultCustomer,
  defaultProject,
  cancelHref,
}: {
  action: (s: FormState, f: FormData) => Promise<FormState>;
  sub?: Tables<"subscriptions">;
  customers: { id: number; name: string }[];
  items: Item[];
  taxRates: number[];
  projects: { id: number; name: string; customer_id: number }[];
  defaultCustomer?: number;
  defaultProject?: number;
  cancelHref: string;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const [name, setName] = useState(sub?.name ?? "");
  const [desc, setDesc] = useState(sub?.description ?? "");
  const [price, setPrice] = useState(String(sub?.unit_price ?? ""));
  const [qty, setQty] = useState(String(sub?.quantity ?? 1));
  const [tax, setTax] = useState(String(sub?.tax_rate ?? 18));
  const [itemId, setItemId] = useState(String(sub?.item_id ?? ""));
  const [customer, setCustomer] = useState<number | "">(sub?.customer_id ?? defaultCustomer ?? "");
  const theirProjects = projects.filter((p) => p.customer_id === customer);
  const projectValue = sub?.project_id ?? defaultProject;
  const total = useMemo(() => {
    const sub_ = (Number(price) || 0) * (Number(qty) || 0);
    return sub_ + (sub_ * (Number(tax) || 0)) / 100;
  }, [price, qty, tax]);

  return (
    <form action={formAction} className="space-y-6">
      <FormError message={state?.error} />
      <Card>
        <CardHeader title="Plan" />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Customer *" htmlFor="customer_id">
            <select id="customer_id" name="customer_id" required value={customer} onChange={(e) => setCustomer(Number(e.target.value) || "")} disabled={!!sub} className="field">
              <option value="">Choose…</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {sub && <input type="hidden" name="customer_id" value={sub.customer_id} />}
          </Field>
          <Field label="Project" htmlFor="project_id" hint={customer ? "Its invoices are linked to the project too" : "Pick a customer first"}>
            <select key={`p${customer}`} id="project_id" name="project_id" defaultValue={theirProjects.some((p) => p.id === projectValue) ? projectValue : ""} disabled={!theirProjects.length} className="field">
              <option value="">—</option>
              {theirProjects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="From catalogue" htmlFor="item_id" hint="Optional — fills in the name and price">
            <select
              id="item_id"
              name="item_id"
              value={itemId}
              onChange={(e) => {
                setItemId(e.target.value);
                const it = items.find((i) => String(i.id) === e.target.value);
                if (it) {
                  setName(it.name);
                  setDesc(it.description ?? "");
                  setPrice(String(it.rate));
                  setTax(String(it.tax_rate));
                }
              }}
              className="field"
            >
              <option value="">— Custom plan —</option>
              {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </Field>
          <Field label="Plan name *" htmlFor="name" className="sm:col-span-2">
            <input id="name" name="name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Gnexa Professional — 25 users" className="field" />
          </Field>
          <Field label="Description" htmlFor="description" className="sm:col-span-2">
            <input id="description" name="description" value={desc} onChange={(e) => setDesc(e.target.value)} className="field" />
          </Field>
          <div className="grid grid-cols-3 gap-3 sm:col-span-2">
            <Field label="Quantity" htmlFor="quantity">
              <input id="quantity" name="quantity" type="number" min="0.01" step="0.01" value={qty} onChange={(e) => setQty(e.target.value)} className="field" />
            </Field>
            <Field label="Price per period *" htmlFor="unit_price">
              <input id="unit_price" name="unit_price" type="number" min="0" step="0.01" required value={price} onChange={(e) => setPrice(e.target.value)} className="field" />
            </Field>
            <Field label="GST" htmlFor="tax_rate">
              <select id="tax_rate" name="tax_rate" value={tax} onChange={(e) => setTax(e.target.value)} className="field">
                {[0, ...taxRates].map((t) => <option key={t} value={t}>{t ? `${t}%` : "None"}</option>)}
              </select>
            </Field>
          </div>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Billing" description={`${formatMoney(total)} per invoice, incl. GST`} />
        <CardBody className="grid gap-4 sm:grid-cols-3">
          <Field label="Bill every" htmlFor="interval_count">
            <div className="flex gap-2">
              <input id="interval_count" name="interval_count" type="number" min={1} max={36} defaultValue={sub?.interval_count ?? 1} className="field w-20" />
              <select name="interval_unit" defaultValue={sub?.interval_unit ?? "month"} className="field" aria-label="Billing unit">
                <option value="week">week(s)</option>
                <option value="month">month(s)</option>
                <option value="year">year(s)</option>
              </select>
            </div>
          </Field>
          {!sub && (
            <Field label="First billing date" htmlFor="start_date" hint="Today or in the past bills right away">
              <input id="start_date" name="start_date" type="date" defaultValue={todayIST()} className="field" />
            </Field>
          )}
          <Field label="End after" htmlFor="ends_after_cycles" hint={sub?.cancel_at_period_end ? "Set to end at the current period — this applies if that's undone" : "Number of invoices — blank for no end"}>
            <input id="ends_after_cycles" name="ends_after_cycles" type="number" min={1} max={240} defaultValue={(sub?.cancel_at_period_end ? sub.ends_after_before_cancel : sub?.ends_after_cycles) ?? ""} placeholder="∞" className="field" />
          </Field>
          <label className="flex items-start gap-2.5 rounded-xl border border-slate-200 p-3 text-sm text-slate-600 sm:col-span-3">
            <input type="checkbox" name="auto_charge" defaultChecked={sub?.auto_charge} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600" />
            <span>
              <b className="text-slate-800">Charge the card on file automatically</b>
              <span className="block text-xs text-slate-500">Each invoice is marked paid the moment it&apos;s raised. Demo only — no real card is charged.</span>
            </span>
          </label>
        </CardBody>
      </Card>
      <div className="flex justify-end gap-2">
        <Link href={cancelHref} className={buttonClass({ variant: "secondary" })}>Cancel</Link>
        <SubmitButton pendingText="Saving…">{sub ? "Save changes" : "Start subscription"}</SubmitButton>
      </div>
    </form>
  );
}
