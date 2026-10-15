import type { Metadata } from "next";
import { Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireAdmin } from "@/lib/auth";
import { deleteCurrency, saveCurrency } from "../actions";

export const metadata: Metadata = { title: "Currencies" };

export default async function CurrenciesPage() {
  const { supabase } = await requireAdmin();
  const { data: list } = await supabase.from("currencies").select("*").order("is_base", { ascending: false }).order("code");
  const base = list?.find((c) => c.is_base);
  return (
    <Card>
      <CardHeader title="Currencies" description={`Bill customers in their own currency. Rates convert to the base currency (${base?.code ?? "INR"}) in reports.`} />
      <ul className="divide-y divide-slate-100">
        {(list ?? []).map((c) => (
          <li key={c.id} className="flex flex-wrap items-center gap-3 px-5 py-2.5 text-sm">
            <form action={saveCurrency} className="flex flex-1 flex-wrap items-center gap-2">
              <input type="hidden" name="id" value={c.id} />
              <span className="w-12 font-mono font-semibold text-slate-900">{c.code}</span>
              <input name="name" defaultValue={c.name} required className="field max-w-[12rem]" aria-label="Name" />
              <input name="symbol" defaultValue={c.symbol} required maxLength={4} className="field w-16" aria-label="Symbol" />
              {c.is_base ? (
                <Badge className="bg-brand-50 text-brand-700 ring-brand-200">Base currency</Badge>
              ) : (
                <>
                  <span className="text-xs text-slate-500">1 {c.code} =</span>
                  <input name="rate" type="number" min="0.000001" step="any" defaultValue={Number(c.rate)} required className="field w-28" aria-label="Exchange rate" />
                  <span className="text-xs text-slate-500">{base?.code}</span>
                  <label className="flex items-center gap-1.5 text-xs text-slate-500"><input type="checkbox" name="make_base" className="h-3.5 w-3.5 rounded border-slate-300" /> Make base</label>
                </>
              )}
              <SubmitButton size="sm" variant="secondary" pendingText="…">Save</SubmitButton>
            </form>
            {!c.is_base && (
              <ConfirmForm action={deleteCurrency} message={`Delete ${c.code}? Existing documents keep their currency.`}>
                <input type="hidden" name="id" value={c.id} />
                <button className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label={`Delete ${c.code}`}><Trash2 className="h-4 w-4" /></button>
              </ConfirmForm>
            )}
          </li>
        ))}
      </ul>
      <form action={saveCurrency} className="flex flex-wrap gap-2 border-t border-slate-100 p-4">
        <input name="code" required maxLength={3} placeholder="Code (e.g. JPY)" className="field w-36 uppercase" />
        <input name="name" required placeholder="Name" className="field max-w-[12rem]" />
        <input name="symbol" required maxLength={4} placeholder="Symbol" className="field w-20" />
        <input name="rate" type="number" min="0.000001" step="any" required placeholder={`Rate in ${base?.code ?? "INR"}`} className="field w-36" />
        <SubmitButton size="sm" variant="secondary" pendingText="Adding…"><Plus className="h-4 w-4" /> Add</SubmitButton>
      </form>
    </Card>
  );
}
