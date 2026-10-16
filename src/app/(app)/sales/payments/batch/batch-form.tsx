"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { Field, FormError } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { cn, formatMoney } from "@/lib/utils";
import { recordBatchPayments } from "../../actions";

export type OpenInvoice = { id: number; label: string; href: string; customer: string; due: string | null; overdue: boolean; balance: number; currency: string };

/** Perfex "Batch payments": one row per open invoice, one shared date and payment mode. */
export function BatchForm({ invoices, modes, today }: { invoices: OpenInvoice[]; modes: { id: number; name: string }[]; today: string }) {
  const [state, action] = useActionState(recordBatchPayments, undefined);
  const [amounts, setAmounts] = useState<Record<number, string>>({});
  const set = (id: number, v: string) => setAmounts((a) => ({ ...a, [id]: v }));
  // After a successful save the balances change — start again from empty amounts
  useEffect(() => {
    if (state?.ok) setAmounts({});
  }, [state]);
  const chosen = invoices.filter((i) => Number(amounts[i.id]) > 0);
  // Totals per currency — amounts in different currencies aren't added together
  const totals = new Map<string, number>();
  for (const i of chosen) totals.set(i.currency, (totals.get(i.currency) ?? 0) + Number(amounts[i.id]));
  const groups = [...new Set(invoices.map((i) => i.customer))];

  return (
    <form action={action} className="space-y-4">
      <FormError message={state?.error} />
      {state?.ok && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700" role="status">{state.ok}</p>}
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Payment date" htmlFor="date"><input id="date" name="date" type="date" required defaultValue={today} className="field" /></Field>
        <Field label="Payment mode" htmlFor="mode_id">
          <select id="mode_id" name="mode_id" className="field">
            <option value="">— Not set —</option>
            {modes.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </Field>
        <div className="flex items-end gap-2">
          <button type="button" onClick={() => setAmounts(Object.fromEntries(invoices.map((i) => [i.id, i.balance.toFixed(2)])))} className="text-xs font-semibold text-brand-600 hover:text-brand-700">Fill all balances</button>
          <span className="text-slate-300">·</span>
          <button type="button" onClick={() => setAmounts({})} className="text-xs font-semibold text-slate-500 hover:text-slate-700">Clear</button>
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="table-base">
          <thead>
            <tr><th>Invoice</th><th className="hidden md:table-cell">Due</th><th className="text-right">Balance</th><th className="w-40 text-right">Amount received</th><th className="hidden w-44 lg:table-cell">Transaction ID</th></tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <FragmentRows key={g} title={g}>
                {invoices.filter((i) => i.customer === g).map((i) => (
                  <tr key={i.id}>
                    <td><Link href={i.href} className="font-mono text-sm font-semibold text-brand-700 hover:underline">{i.label}</Link></td>
                    <td className={cn("hidden whitespace-nowrap md:table-cell", i.overdue ? "font-semibold text-rose-600" : "text-slate-600")}>{i.due ?? "—"}</td>
                    <td className="whitespace-nowrap text-right">
                      <button type="button" onClick={() => set(i.id, i.balance.toFixed(2))} className="font-medium text-slate-700 hover:text-brand-700" title="Pay the full balance">
                        {formatMoney(i.balance, i.currency)}
                      </button>
                    </td>
                    <td className="text-right">
                      <input
                        name={`amount_${i.id}`}
                        type="number"
                        min="0"
                        max={i.balance}
                        step="0.01"
                        inputMode="decimal"
                        value={amounts[i.id] ?? ""}
                        onChange={(e) => set(i.id, e.target.value)}
                        aria-label={`Amount received for ${i.label}`}
                        className="field h-8 w-36 py-1 text-right"
                      />
                    </td>
                    <td className="hidden lg:table-cell"><input name={`ref_${i.id}`} aria-label={`Transaction ID for ${i.label}`} className="field h-8 py-1" /></td>
                  </tr>
                ))}
              </FragmentRows>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-3">
        <span className="text-sm text-slate-500" aria-live="polite">
          {chosen.length ? `${chosen.length} payment${chosen.length === 1 ? "" : "s"} · ${[...totals].map(([c, v]) => formatMoney(v, c)).join(" + ")}` : "Enter the amounts you received"}
        </span>
        <SubmitButton pendingText="Recording…" disabled={!chosen.length}>Record payments</SubmitButton>
      </div>
    </form>
  );
}

function FragmentRows({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <tr className="bg-slate-50/80">
        <td colSpan={5} className="py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</td>
      </tr>
      {children}
    </>
  );
}
