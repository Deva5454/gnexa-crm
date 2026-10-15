"use client";

import { useActionState, useState } from "react";
import { CheckCircle2, CreditCard, Landmark, Lock, Smartphone } from "lucide-react";
import { SubmitButton } from "@/components/ui/submit-button";
import { cn, formatMoney } from "@/lib/utils";
import { payInvoice } from "./actions";

const METHODS = [
  { key: "upi", label: "UPI", icon: Smartphone },
  { key: "card", label: "Card", icon: CreditCard },
  { key: "netbanking", label: "Net banking", icon: Landmark },
] as const;

/** Simulated payment gateway: records a payment, no money moves. */
export function PayNow({ id, balance, currency }: { id: number; balance: number; currency: string }) {
  const [state, action] = useActionState(payInvoice, undefined);
  const [method, setMethod] = useState<(typeof METHODS)[number]["key"]>("upi");
  const [amount, setAmount] = useState(String(Math.round(balance * 100) / 100));
  if (state?.ok)
    return (
      <div className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">
        <CheckCircle2 className="mb-1 h-5 w-5" />
        <b className="block">Thank you!</b>
        {state.ok}
      </div>
    );
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="method" value={method} />
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Payment method">
        {METHODS.map((m) => (
          <button
            key={m.key}
            type="button"
            role="radio"
            aria-checked={method === m.key}
            onClick={() => setMethod(m.key)}
            className={cn(
              "flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-xs font-medium",
              method === m.key ? "border-brand-400 bg-brand-50 text-brand-700 ring-2 ring-brand-100" : "border-slate-200 text-slate-600 hover:bg-slate-50",
            )}
          >
            <m.icon className="h-4 w-4" /> {m.label}
          </button>
        ))}
      </div>
      <label className="block">
        <span className="label">Amount</span>
        <input
          name="amount"
          type="number"
          min="1"
          step="0.01"
          max={balance}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="field"
        />
      </label>
      {state?.error && <p className="text-xs text-rose-600">{state.error}</p>}
      <SubmitButton className="w-full" pendingText="Processing…">
        <Lock className="h-3.5 w-3.5" /> Pay {formatMoney(Number(amount) || 0, currency)}
      </SubmitButton>
      <p className="text-center text-[11px] text-slate-400">Demo gateway — no card or bank details are asked for and no money is moved.</p>
    </form>
  );
}
